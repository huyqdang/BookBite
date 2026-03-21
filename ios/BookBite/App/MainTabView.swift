import SwiftUI

struct MainTabView: View {
    @EnvironmentObject var appState: AppState
    @Namespace private var tabAnimation

    var body: some View {
        ZStack(alignment: .bottom) {
            // Content
            TabView(selection: $appState.selectedTab) {
                FeedView()
                    .tag(AppState.Tab.feed)

                BookmarksView()
                    .tag(AppState.Tab.bookmarks)

                ProfileView()
                    .tag(AppState.Tab.profile)
            }
            .tabViewStyle(.automatic)

            // Custom Tab Bar
            customTabBar
        }
        .ignoresSafeArea(.keyboard)
    }

    private var customTabBar: some View {
        HStack(spacing: 0) {
            ForEach(AppState.Tab.allCases, id: \.self) { tab in
                tabButton(tab)
            }
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 28)
        .background(
            Rectangle()
                .fill(.white)
                .shadow(color: .black.opacity(0.06), radius: 12, y: -4)
                .ignoresSafeArea()
        )
    }

    private func tabButton(_ tab: AppState.Tab) -> some View {
        Button {
            withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                appState.selectedTab = tab
            }
        } label: {
            VStack(spacing: 4) {
                Image(systemName: iconName(for: tab))
                    .font(.system(size: 20, weight: appState.selectedTab == tab ? .semibold : .regular))
                    .scaleEffect(appState.selectedTab == tab ? 1.1 : 1.0)

                Text(tab.rawValue)
                    .font(.system(size: 10, weight: .medium))

                if appState.selectedTab == tab {
                    Circle()
                        .fill(Color.black)
                        .frame(width: 4, height: 4)
                        .matchedGeometryEffect(id: "tabIndicator", in: tabAnimation)
                } else {
                    Circle()
                        .fill(Color.clear)
                        .frame(width: 4, height: 4)
                }
            }
            .foregroundColor(appState.selectedTab == tab ? .black : .gray)
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(.plain)
    }

    private func iconName(for tab: AppState.Tab) -> String {
        switch tab {
        case .feed: return "text.book.closed"
        case .bookmarks: return "bookmark"
        case .profile: return "person"
        }
    }
}
