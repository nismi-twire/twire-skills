// HubstaffBar: menu bar widget for the Twire hubstaff skill (hs.js).
// Shows today's tracked time and the week's balance, refreshes every 5 minutes.
import AppKit
import UserNotifications

let refreshInterval: TimeInterval = 5 * 60

// Behind-pace alert: today's target is expected to build up evenly across this window.
let workdayStart = 9.0                     // hour of day, local time
let workdayEnd = 18.0
let behindGrace = 30 * 60                  // ignore shortfalls smaller than this
let alertRepeat: TimeInterval = 60 * 60    // re-alert at most hourly while still behind
let alertsKey = "behindAlerts"

// MARK: - Data

struct Period {
    let worked: Int          // seconds tracked in the period so far
    let overall: Int         // active seconds (for activity %)
    let diff: Int            // worked + leave - expected so far
    let target: Int
    let stillToWork: Int
    let workingDaysLeft: Int
    let perWorkingDay: Int
    let today: Int?          // seconds tracked today, if today is in the period
    let todayTarget: Int?

    init(json: [String: Any]) {
        let total = json["total"] as? [String: Any] ?? [:]
        let rem = json["remaining"] as? [String: Any] ?? [:]
        worked = total["tracked"] as? Int ?? 0
        overall = total["overall"] as? Int ?? 0
        diff = json["diff"] as? Int ?? 0
        target = rem["target"] as? Int ?? 0
        stillToWork = rem["stillToWork"] as? Int ?? 0
        workingDaysLeft = rem["workingDaysLeft"] as? Int ?? 0
        perWorkingDay = rem["perWorkingDay"] as? Int ?? 0

        let todayStr = json["to"] as? String
        let cal = json["calendar"] as? [[String: Any]] ?? []
        if let day = cal.first(where: { $0["date"] as? String == todayStr }) {
            today = day["worked"] as? Int ?? 0
            let dayHours = json["dayHours"] as? Int ?? 8
            let isWorkday = day["workday"] as? Bool ?? false
            let leave = day["leave"] as? Int ?? 0
            todayTarget = isWorkday ? max(0, dayHours * 3600 - leave) : 0
        } else {
            today = nil
            todayTarget = nil
        }
    }

    var activity: Int { worked > 0 ? Int((Double(overall) / Double(worked) * 100).rounded()) : 0 }

    /// Seconds today's target says you should have tracked by `now`.
    func expectedToday(at now: Date = Date()) -> Int? {
        guard let target = todayTarget, target > 0 else { return nil }
        let c = Calendar.current.dateComponents([.hour, .minute], from: now)
        let hour = Double(c.hour ?? 0) + Double(c.minute ?? 0) / 60
        let fraction = min(1, max(0, (hour - workdayStart) / (workdayEnd - workdayStart)))
        return Int(Double(target) * fraction)
    }

    /// How far behind today's pace you are, or nil when on pace (within the grace).
    func behindToday(at now: Date = Date()) -> Int? {
        guard let t = today, let expected = expectedToday(at: now) else { return nil }
        let short = expected - t
        return short > behindGrace ? short : nil
    }
}

func notify(_ title: String, _ body: String) {
    let center = UNUserNotificationCenter.current()
    center.getNotificationSettings { s in
        if s.authorizationStatus == .authorized || s.authorizationStatus == .provisional {
            let c = UNMutableNotificationContent()
            c.title = title
            c.body = body
            c.sound = .default
            center.add(UNNotificationRequest(identifier: "behind", content: c, trigger: nil))
        } else {
            // Not allowed (or never asked): fall back to a plain AppleScript notification.
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/usr/bin/osascript")
            p.arguments = ["-e", "on run argv", "-e",
                           "display notification (item 2 of argv) with title (item 1 of argv) sound name \"default\"",
                           "-e", "end run", title, body]
            try? p.run()
        }
    }
}

enum FetchError: Error {
    case notConnected(String)
    case failed(String)
}

func findNode() -> String? {
    for p in ["/opt/homebrew/bin/node", "/usr/local/bin/node", "/usr/bin/node"]
    where FileManager.default.isExecutableFile(atPath: p) { return p }
    // Fall back to the login shell's PATH (nvm, volta, ...)
    let p = Process()
    p.executableURL = URL(fileURLWithPath: "/bin/zsh")
    p.arguments = ["-lc", "command -v node"]
    let out = Pipe()
    p.standardOutput = out
    try? p.run()
    p.waitUntilExit()
    let s = String(data: out.fileHandleForReading.readDataToEndOfFile(), encoding: .utf8)?
        .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    return s.isEmpty ? nil : s
}

/// Newest installed version of the hubstaff plugin, so plugin updates are picked up automatically.
func findScript() -> String? {
    let fm = FileManager.default
    let home = fm.homeDirectoryForCurrentUser.path
    let cache = "\(home)/.claude/plugins/cache/twire/hubstaff"
    let versions = (try? fm.contentsOfDirectory(atPath: cache)) ?? []
    let sorted = versions.sorted { $0.compare($1, options: .numeric) == .orderedDescending }
    for v in sorted {
        let path = "\(cache)/\(v)/skills/hubstaff/scripts/hs.js"
        if fm.fileExists(atPath: path) { return path }
    }
    let marketplace = "\(home)/.claude/plugins/marketplaces/twire/plugins/hubstaff/skills/hubstaff/scripts/hs.js"
    return fm.fileExists(atPath: marketplace) ? marketplace : nil
}

func runHS(_ node: String, _ script: String, _ args: [String]) throws -> [String: Any] {
    let p = Process()
    p.executableURL = URL(fileURLWithPath: node)
    p.arguments = [script] + args
    let out = Pipe(), err = Pipe()
    p.standardOutput = out
    p.standardError = err
    try p.run()
    let data = out.fileHandleForReading.readDataToEndOfFile()
    let errData = err.fileHandleForReading.readDataToEndOfFile()
    p.waitUntilExit()
    let errText = String(data: errData, encoding: .utf8)?
        .trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
    if p.terminationStatus == 2 { throw FetchError.notConnected(errText) }
    guard p.terminationStatus == 0,
          let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
        throw FetchError.failed(errText.isEmpty ? "hs.js exited with \(p.terminationStatus)" : errText)
    }
    return json
}

// MARK: - Formatting

func hm(_ seconds: Int) -> String {
    let m = abs(seconds) / 60
    return String(format: "%dh %02dm", m / 60, m % 60)
}

func signed(_ seconds: Int) -> String {
    seconds >= 0 ? "+\(hm(seconds))" : "−\(hm(seconds))"
}

func balance(_ seconds: Int) -> String {
    seconds >= 0 ? "\(hm(seconds)) ahead" : "\(hm(seconds)) short"
}

// MARK: - App

final class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    var timer: Timer?
    var lastUpdate: Date?
    var week: Period?
    var month: Period?
    var error: FetchError?
    var loading = false
    var lastAlert: Date?
    var alertsOn = UserDefaults.standard.object(forKey: alertsKey) as? Bool ?? true

    func applicationDidFinishLaunching(_ n: Notification) {
        UNUserNotificationCenter.current().delegate = self
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { _, _ in }
        item.button?.title = "⏱ …"
        rebuildMenu()
        refresh()
        timer = Timer.scheduledTimer(withTimeInterval: refreshInterval, repeats: true) { [weak self] _ in
            self?.refresh()
        }
        // Refresh right after the Mac wakes, instead of waiting for the next tick.
        NSWorkspace.shared.notificationCenter.addObserver(
            self, selector: #selector(refresh), name: NSWorkspace.didWakeNotification, object: nil)
    }

    @objc func refresh() {
        if loading { return }
        loading = true
        DispatchQueue.global(qos: .utility).async {
            var week: Period?, month: Period?, failure: FetchError?
            if let node = findNode(), let script = findScript() {
                do {
                    week = Period(json: try runHS(node, script, ["hours", "week", "--json"]))
                    month = Period(json: try runHS(node, script, ["hours", "month", "--json"]))
                } catch let e as FetchError {
                    failure = e
                } catch let e {
                    failure = .failed(e.localizedDescription)
                }
            } else {
                failure = .failed("node or the hubstaff plugin (hs.js) was not found")
            }
            DispatchQueue.main.async {
                self.loading = false
                self.error = failure
                if failure == nil {
                    self.week = week
                    self.month = month
                    self.lastUpdate = Date()
                    self.checkBehind()
                }
                self.render()
            }
        }
    }

    func checkBehind() {
        guard alertsOn, let w = week, let short = w.behindToday(),
              let t = w.today, let target = w.todayTarget else {
            lastAlert = nil // back on pace: alert straight away if you fall behind again
            return
        }
        if let last = lastAlert, Date().timeIntervalSince(last) < alertRepeat { return }
        lastAlert = Date()
        notify("Behind for today",
               "\(hm(short)) behind pace. Tracked \(hm(t)) of \(hm(target)), \(hm(target - t)) to go.")
    }

    @objc func toggleAlerts() {
        alertsOn.toggle()
        UserDefaults.standard.set(alertsOn, forKey: alertsKey)
        if alertsOn { checkBehind() }
        rebuildMenu()
    }

    // Show banners even though the app counts as "active" while its menu is open.
    func userNotificationCenter(_ c: UNUserNotificationCenter, willPresent n: UNNotification,
                                withCompletionHandler done: @escaping (UNNotificationPresentationOptions) -> Void) {
        done([.banner, .sound])
    }

    func render() {
        guard let button = item.button else { return }
        if case .notConnected = error {
            button.attributedTitle = NSAttributedString(string: "⏱ ⚠️ login")
        } else if let w = week {
            let today = w.today.map(hm) ?? hm(0)
            let title = NSMutableAttributedString(string: "⏱ ")
            title.append(NSAttributedString(
                string: today, attributes: w.behindToday() != nil ? [.foregroundColor: NSColor.systemOrange] : [:]))
            title.append(NSAttributedString(string: "  "))
            let color: NSColor = w.diff >= 0 ? .systemGreen : .systemRed
            title.append(NSAttributedString(string: signed(w.diff), attributes: [.foregroundColor: color]))
            if error != nil { title.append(NSAttributedString(string: " ⚠️")) }
            button.attributedTitle = title
        } else if error != nil {
            button.attributedTitle = NSAttributedString(string: "⏱ ⚠️")
        }
        button.toolTip = "Hubstaff: today tracked · week balance"
        rebuildMenu()
    }

    func rebuildMenu() {
        let menu = NSMenu()
        func info(_ s: String, bold: Bool = false) {
            let mi = NSMenuItem(title: s, action: nil, keyEquivalent: "")
            if bold {
                mi.attributedTitle = NSAttributedString(
                    string: s, attributes: [.font: NSFont.boldSystemFont(ofSize: NSFont.systemFontSize)])
            }
            mi.isEnabled = false
            menu.addItem(mi)
        }

        switch error {
        case .notConnected(let msg)?:
            info("⚠️ Not connected to Hubstaff", bold: true)
            info(msg.isEmpty ? "Run the hubstaff login in Claude Code" : String(msg.prefix(120)))
            info("Ask Claude: \"connect me to Hubstaff\"")
            menu.addItem(.separator())
        case .failed(let msg)?:
            info("⚠️ Last refresh failed", bold: true)
            info(String(msg.prefix(120)))
            menu.addItem(.separator())
        case nil: break
        }

        if let w = week {
            info("Today", bold: true)
            if let t = w.today {
                let target = w.todayTarget ?? 0
                info("Tracked: \(hm(t))" + (target > 0 ? " of \(hm(target))" : ""))
                if target > 0 { info(t >= target ? "Done for today ✅" : "To go: \(hm(target - t))") }
                if t < target, let expected = w.expectedToday() {
                    if let short = w.behindToday() {
                        info("🟠 Behind pace: \(hm(short)) (about \(hm(expected)) expected by now)")
                    } else {
                        info("On pace (about \(hm(expected)) expected by now)")
                    }
                }
            }
            menu.addItem(.separator())
            info("This week", bold: true)
            info("Worked: \(hm(w.worked)) of \(hm(w.target))")
            info("Result: \(balance(w.diff))")
            info("Still to work: \(hm(w.stillToWork))")
            if w.workingDaysLeft > 0 {
                info("Per working day: \(hm(w.perWorkingDay)) (\(w.workingDaysLeft) days left)")
            }
            info("Activity: \(w.activity)%")
        }
        if let m = month {
            menu.addItem(.separator())
            info("This month", bold: true)
            info("Worked: \(hm(m.worked)) of \(hm(m.target))")
            info("Result: \(balance(m.diff))")
            info("Still to work: \(hm(m.stillToWork))")
            if m.workingDaysLeft > 0 {
                info("Per working day: \(hm(m.perWorkingDay)) (\(m.workingDaysLeft) days left)")
            }
        }

        menu.addItem(.separator())
        if let d = lastUpdate {
            let f = DateFormatter()
            f.dateFormat = "HH:mm"
            info("Updated \(f.string(from: d)) · every \(Int(refreshInterval / 60)) min")
        }
        menu.addItem(NSMenuItem(title: "Refresh now", action: #selector(refresh), keyEquivalent: "r"))
        menu.addItem(NSMenuItem(title: "Open Hubstaff", action: #selector(openHubstaff), keyEquivalent: "o"))
        let alerts = NSMenuItem(title: "Alert when behind for the day", action: #selector(toggleAlerts), keyEquivalent: "")
        alerts.state = alertsOn ? .on : .off
        menu.addItem(alerts)
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        for mi in menu.items where mi.action != nil && mi.action != #selector(NSApplication.terminate(_:)) {
            mi.target = self
        }
        item.menu = menu
    }

    @objc func openHubstaff() {
        NSWorkspace.shared.open(URL(string: "https://app.hubstaff.com/dashboard")!)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory) // menu bar only, no Dock icon
app.run()
