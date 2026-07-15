import WidgetKit
import SwiftUI

// "Use It Up" widget — shows the 3 soonest-expiring pantry items. Data is
// published by the app into a shared App Group (see ios/App/App/
// PantreWidgetPlugin.swift and src/lib/widget.ts).

private let appGroup = "group.com.elghazzali.shelflife"
private let dataKey = "pantreWidgetData"

struct WidgetItem: Codable, Identifiable {
    let name: String
    let daysLeft: Int
    let expirationDate: String
    var id: String { name + expirationDate }
}

struct WidgetPayload: Codable {
    let updatedAt: String
    let expiringCount: Int
    let items: [WidgetItem]
}

func loadPayload() -> WidgetPayload? {
    guard let defaults = UserDefaults(suiteName: appGroup),
          let raw = defaults.string(forKey: dataKey),
          let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(WidgetPayload.self, from: data)
}

struct PantreEntry: TimelineEntry {
    let date: Date
    let payload: WidgetPayload?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> PantreEntry {
        PantreEntry(date: Date(), payload: WidgetPayload(updatedAt: "", expiringCount: 2, items: [
            WidgetItem(name: "Spinach", daysLeft: 1, expirationDate: ""),
            WidgetItem(name: "Greek Yogurt", daysLeft: 2, expirationDate: ""),
            WidgetItem(name: "Chicken", daysLeft: 3, expirationDate: ""),
        ]))
    }

    func getSnapshot(in context: Context, completion: @escaping (PantreEntry) -> Void) {
        completion(PantreEntry(date: Date(), payload: loadPayload()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<PantreEntry>) -> Void) {
        let entry = PantreEntry(date: Date(), payload: loadPayload())
        // The app pokes WidgetCenter on every pantry change; this is just a
        // safety-net refresh so "days left" stays current across midnight.
        let next = Calendar.current.date(byAdding: .hour, value: 6, to: Date())
            ?? Date().addingTimeInterval(6 * 3600)
        completion(Timeline(entries: [entry], policy: .after(next)))
    }
}

func freshnessColor(_ days: Int) -> Color {
    if days < 0 { return Color(red: 0.78, green: 0.22, blue: 0.22) }   // expired
    if days <= 1 { return Color(red: 0.85, green: 0.45, blue: 0.10) }  // expiring
    if days <= 3 { return Color(red: 0.90, green: 0.72, blue: 0.10) }  // soon
    return Color(red: 0.29, green: 0.49, blue: 0.35)                   // fresh
}

func daysLabel(_ days: Int) -> String {
    if days < 0 { return "expired" }
    if days == 0 { return "today" }
    if days == 1 { return "1 day" }
    return "\(days) days"
}

struct PantreWidgetEntryView: View {
    var entry: Provider.Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Text("🥑").font(.system(size: 14))
                Text("Use it up").font(.system(size: 13, weight: .bold))
                Spacer()
            }

            if let items = entry.payload?.items, !items.isEmpty {
                ForEach(items.prefix(3)) { item in
                    HStack(spacing: 6) {
                        Circle().fill(freshnessColor(item.daysLeft)).frame(width: 7, height: 7)
                        Text(item.name).font(.system(size: 13, weight: .medium)).lineLimit(1)
                        Spacer()
                        Text(daysLabel(item.daysLeft))
                            .font(.system(size: 11))
                            .foregroundColor(.secondary)
                    }
                }
            } else {
                Spacer()
                Text("Nothing expiring soon 🎉")
                    .font(.system(size: 12))
                    .foregroundColor(.secondary)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .containerBackground(for: .widget) { Color(UIColor.systemBackground) }
    }
}

@main
struct PantreWidget: Widget {
    let kind = "PantreWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            PantreWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Use It Up")
        .description("See what's expiring soonest in your pantry.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
