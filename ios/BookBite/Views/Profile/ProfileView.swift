import SwiftUI

struct ProfileView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = ProfileViewModel()
    @ObservedObject private var readingSettings = ReadingSettings.shared
    @State private var showEditPreferences = false
    @State private var showReaderSettings = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: BBSpacing.lg) {
                    // Avatar + Name
                    profileHeader

                    // Stats
                    if let profile = viewModel.profile {
                        statsSection(stats: profile.stats)
                    }

                    // Preferences
                    if let prefs = viewModel.profile?.preferences {
                        preferencesSection(prefs: prefs)
                    }

                    // Settings
                    settingsSection

                    Spacer(minLength: 100)
                }
                .padding(.horizontal, BBSpacing.md)
                .padding(.top, BBSpacing.md)
            }
            .background(BBColors.background)
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $showEditPreferences) {
                EditPreferencesView(viewModel: viewModel)
            }
            .sheet(isPresented: $showReaderSettings) {
                ReaderSettingsSheet()
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
        }
        .task {
            await viewModel.loadProfile()
            // Sync server font settings to local on profile load
            if let prefs = viewModel.profile?.preferences {
                readingSettings.applyFromServer(fontFamily: prefs.fontFamily, fontSize: prefs.fontSize)
            }
        }
    }

    // MARK: - Header

    private var profileHeader: some View {
        VStack(spacing: BBSpacing.sm) {
            // Avatar
            Circle()
                .fill(BBColors.surface)
                .frame(width: 80, height: 80)
                .overlay(
                    Text(viewModel.profile?.displayName.prefix(1).uppercased() ?? "?")
                        .font(BBFonts.displayMedium())
                        .foregroundColor(BBColors.textSecondary)
                )

            Text(viewModel.profile?.displayName ?? "Loading...")
                .font(BBFonts.titleLarge())
                .foregroundColor(BBColors.text)

            if let email = viewModel.profile?.email {
                Text(email)
                    .font(BBFonts.bodySmall())
                    .foregroundColor(BBColors.textTertiary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, BBSpacing.lg)
    }

    // MARK: - Stats

    private func statsSection(stats: UserStats) -> some View {
        HStack(spacing: 0) {
            statItem(value: "\(stats.storiesRead)", label: "Read")
            Divider().frame(height: 40)
            statItem(value: "\(stats.likes)", label: "Liked")
            Divider().frame(height: 40)
            statItem(value: "\(stats.bookmarks)", label: "Saved")
        }
        .padding(.vertical, BBSpacing.md)
        .background(BBColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: BBRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: BBRadius.lg)
                .stroke(BBColors.border, lineWidth: 1)
        )
    }

    private func statItem(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(BBFonts.displaySmall())
                .foregroundColor(BBColors.text)
            Text(label)
                .font(BBFonts.caption())
                .foregroundColor(BBColors.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Preferences

    private func preferencesSection(prefs: UserPreferences) -> some View {
        VStack(alignment: .leading, spacing: BBSpacing.sm) {
            HStack {
                Text("Preferences")
                    .font(BBFonts.titleMedium())
                Spacer()
                Button("Edit") {
                    showEditPreferences = true
                }
                .font(BBFonts.bodySmall())
                .foregroundColor(BBColors.textSecondary)
            }

            // Categories
            FlowLayout(spacing: 6) {
                ForEach(prefs.bookCategories, id: \.self) { category in
                    Text(category)
                        .font(BBFonts.label())
                        .foregroundColor(BBColors.textSecondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(BBColors.surface)
                        .clipShape(Capsule())
                        .overlay(
                            Capsule()
                                .stroke(BBColors.border, lineWidth: 1)
                        )
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Reading times")
                    .font(BBFonts.bodySmall())
                    .foregroundColor(BBColors.textSecondary)

                HStack(spacing: 6) {
                    ForEach(prefs.preferredReadingTimes.sorted(), id: \.self) { time in
                        Text("\(time) min")
                            .font(BBFonts.label())
                            .foregroundColor(BBColors.text)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(BBColors.surface)
                            .clipShape(Capsule())
                            .overlay(
                                Capsule()
                                    .stroke(BBColors.borderStrong, lineWidth: 1)
                            )
                    }
                }
            }
        }
        .padding(BBSpacing.md)
        .background(BBColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: BBRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: BBRadius.lg)
                .stroke(BBColors.border, lineWidth: 1)
        )
    }

    // MARK: - Settings

    private var settingsSection: some View {
        VStack(spacing: 0) {
            // Reader settings row with live font preview
            Button {
                showReaderSettings = true
            } label: {
                HStack(spacing: BBSpacing.md) {
                    Text("Aa")
                        .font(.system(size: 16, weight: .medium, design: .serif))
                        .foregroundColor(BBColors.text)
                        .frame(width: 24, alignment: .center)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Reader Settings")
                            .font(BBFonts.bodyLarge())
                            .foregroundColor(BBColors.text)
                        Text("\(readingSettings.fontFamily.displayName), \(readingSettings.fontSize)pt")
                            .font(BBFonts.caption())
                            .foregroundColor(BBColors.textTertiary)
                    }
                    Spacer()
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundColor(BBColors.textTertiary)
                }
                .padding(.horizontal, BBSpacing.md)
                .padding(.vertical, 14)
            }
            Divider().padding(.leading, 52)
            settingsRow(icon: "bell", title: "Notifications")
            Divider().padding(.leading, 52)
            settingsRow(icon: "shield", title: "Privacy")
            Divider().padding(.leading, 52)
            settingsRow(icon: "questionmark.circle", title: "Help & Support")
            Divider().padding(.leading, 52)

            Button {
                authViewModel.logout()
            } label: {
                HStack(spacing: BBSpacing.md) {
                    Image(systemName: "rectangle.portrait.and.arrow.right")
                        .font(.system(size: 16))
                        .foregroundColor(.red)
                        .frame(width: 24)
                    Text("Sign Out")
                        .font(BBFonts.bodyLarge())
                        .foregroundColor(.red)
                    Spacer()
                }
                .padding(.horizontal, BBSpacing.md)
                .padding(.vertical, 14)
            }
        }
        .background(BBColors.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: BBRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: BBRadius.lg)
                .stroke(BBColors.border, lineWidth: 1)
        )
    }

    private func settingsRow(icon: String, title: String) -> some View {
        Button {
            // Settings navigation
        } label: {
            HStack(spacing: BBSpacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundColor(BBColors.text)
                    .frame(width: 24)
                Text(title)
                    .font(BBFonts.bodyLarge())
                    .foregroundColor(BBColors.text)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(BBColors.textTertiary)
            }
            .padding(.horizontal, BBSpacing.md)
            .padding(.vertical, 14)
        }
    }
}

// MARK: - Edit Preferences Sheet

struct EditPreferencesView: View {
    @ObservedObject var viewModel: ProfileViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var selectedCategories: Set<BookCategory> = []
    @State private var selectedReadingTimes: Set<ReadingTime> = [.threeMin]

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: BBSpacing.lg) {
                    // Categories
                    VStack(alignment: .leading, spacing: BBSpacing.sm) {
                        Text("Book Categories")
                            .font(BBFonts.titleMedium())

                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible()),
                        ], spacing: BBSpacing.sm) {
                            ForEach(BookCategory.allCases) { category in
                                CategoryChip(
                                    category: category,
                                    isSelected: selectedCategories.contains(category)
                                ) {
                                    if selectedCategories.contains(category) {
                                        selectedCategories.remove(category)
                                    } else {
                                        selectedCategories.insert(category)
                                    }
                                }
                            }
                        }
                    }

                    // Reading times (multi-select)
                    VStack(alignment: .leading, spacing: BBSpacing.sm) {
                        Text("Reading Times")
                            .font(BBFonts.titleMedium())

                        Text("Select one or more to diversify your feed.")
                            .font(BBFonts.bodySmall())
                            .foregroundColor(BBColors.textSecondary)

                        ForEach(ReadingTime.allCases) { time in
                            ReadingTimeOption(
                                time: time,
                                isSelected: selectedReadingTimes.contains(time)
                            ) {
                                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                    if selectedReadingTimes.contains(time) {
                                        if selectedReadingTimes.count > 1 {
                                            selectedReadingTimes.remove(time)
                                        }
                                    } else {
                                        selectedReadingTimes.insert(time)
                                    }
                                }
                            }
                        }
                    }
                }
                .padding(.horizontal, BBSpacing.lg)
                .padding(.top, BBSpacing.md)
            }
            .background(BBColors.background)
            .navigationTitle("Edit Preferences")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") { dismiss() }
                        .foregroundColor(BBColors.textSecondary)
                }
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        Task {
                            await viewModel.updatePreferences(
                                categories: selectedCategories.map(\.rawValue),
                                readingTimes: selectedReadingTimes.map(\.rawValue).sorted()
                            )
                            dismiss()
                        }
                    }
                    .fontWeight(.semibold)
                    .foregroundColor(BBColors.text)
                }
            }
        }
        .onAppear {
            if let prefs = viewModel.profile?.preferences {
                selectedCategories = Set(prefs.bookCategories.compactMap { BookCategory(rawValue: $0) })
                selectedReadingTimes = Set(prefs.preferredReadingTimes.compactMap { ReadingTime(rawValue: $0) })
                if selectedReadingTimes.isEmpty {
                    selectedReadingTimes = [.threeMin]
                }
            }
        }
    }
}

// MARK: - Flow Layout for Tags

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = arrangement(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = arrangement(proposal: proposal, subviews: subviews)
        for (index, subview) in subviews.enumerated() {
            if index < result.positions.count {
                let position = result.positions[index]
                subview.place(at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y), proposal: .unspecified)
            }
        }
    }

    private func arrangement(proposal: ProposedViewSize, subviews: Subviews) -> (positions: [CGPoint], size: CGSize) {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var maxHeight: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if currentX + size.width > maxWidth && currentX > 0 {
                currentX = 0
                currentY += rowHeight + spacing
                rowHeight = 0
            }
            positions.append(CGPoint(x: currentX, y: currentY))
            currentX += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            maxHeight = max(maxHeight, currentY + rowHeight)
        }

        return (positions, CGSize(width: maxWidth, height: maxHeight))
    }
}
