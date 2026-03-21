import SwiftUI
import AuthenticationServices

struct OnboardingView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @StateObject private var viewModel = OnboardingViewModel()

    /// When the user is already authenticated (e.g. logged in but never set preferences),
    /// we skip the signup step and just show 3 preference steps.
    private var isPostLogin: Bool { authViewModel.isAuthenticated }
    private var effectiveTotalSteps: Int { isPostLogin ? 3 : 4 }
    private var effectiveProgress: Double {
        Double(viewModel.currentStep + 1) / Double(effectiveTotalSteps)
    }

    var body: some View {
        VStack(spacing: 0) {
            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Rectangle()
                        .fill(BBColors.surface)
                        .frame(height: 3)

                    Rectangle()
                        .fill(BBColors.primary)
                        .frame(width: geo.size.width * effectiveProgress, height: 3)
                        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: effectiveProgress)
                }
            }
            .frame(height: 3)
            .padding(.top, 8)

            // Step indicator
            HStack {
                Text("Step \(viewModel.currentStep + 1) of \(effectiveTotalSteps)")
                    .font(BBFonts.caption())
                    .foregroundColor(BBColors.textTertiary)
                Spacer()
            }
            .padding(.horizontal, BBSpacing.lg)
            .padding(.top, BBSpacing.sm)

            // Content
            TabView(selection: $viewModel.currentStep) {
                purposeStep.tag(0)
                categorySelectionStep.tag(1)
                readingTimeStep.tag(2)
                if !isPostLogin {
                    signupStep.tag(3)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .animation(.spring(response: 0.4, dampingFraction: 0.85), value: viewModel.currentStep)

            // Bottom section
            bottomBar
        }
        .background(BBColors.background)
    }

    // MARK: - Step 0: Purpose

    private var purposeStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: BBSpacing.lg) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("What brings you\nto BookBite?")
                        .font(BBFonts.displayMedium())
                        .foregroundColor(BBColors.text)

                    Text("This helps us pick the best stories for you.")
                        .font(BBFonts.bodyMedium())
                        .foregroundColor(BBColors.textSecondary)
                }
                .padding(.top, BBSpacing.xl)

                VStack(spacing: BBSpacing.sm) {
                    ForEach(ReadingPurpose.allCases) { purpose in
                        PurposeOption(
                            purpose: purpose,
                            isSelected: viewModel.selectedPurpose == purpose
                        ) {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                viewModel.selectPurpose(purpose)
                            }
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        }
                    }
                }
            }
            .padding(.horizontal, BBSpacing.lg)
        }
    }

    // MARK: - Step 1: Categories

    private var categorySelectionStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: BBSpacing.lg) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("What do you love\nto read?")
                        .font(BBFonts.displayMedium())
                        .foregroundColor(BBColors.text)

                    if viewModel.selectedPurpose != nil {
                        Text("We've pre-selected some based on your goal. Adjust as you like — pick at least 3.")
                            .font(BBFonts.bodyMedium())
                            .foregroundColor(BBColors.textSecondary)
                    } else {
                        Text("Pick at least 3 categories to personalize your feed.")
                            .font(BBFonts.bodyMedium())
                            .foregroundColor(BBColors.textSecondary)
                    }
                }
                .padding(.top, BBSpacing.xl)

                LazyVGrid(columns: [
                    GridItem(.flexible()),
                    GridItem(.flexible()),
                ], spacing: BBSpacing.sm) {
                    ForEach(BookCategory.allCases) { category in
                        CategoryChip(
                            category: category,
                            isSelected: viewModel.selectedCategories.contains(category)
                        ) {
                            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                                viewModel.toggleCategory(category)
                            }
                            UIImpactFeedbackGenerator(style: .light).impactOccurred()
                        }
                    }
                }

                HStack {
                    Spacer()
                    Text("\(viewModel.selectedCategories.count) selected")
                        .font(BBFonts.caption())
                        .foregroundColor(
                            viewModel.selectedCategories.count >= 3
                                ? BBColors.textSecondary
                                : BBColors.textTertiary
                        )
                }
                .padding(.top, BBSpacing.xs)
            }
            .padding(.horizontal, BBSpacing.lg)
            .padding(.bottom, BBSpacing.lg)
        }
    }

    // MARK: - Step 2: Reading Time

    private var readingTimeStep: some View {
        VStack(alignment: .leading, spacing: BBSpacing.xl) {
            VStack(alignment: .leading, spacing: 8) {
                Text("How long do you\nlike to read?")
                    .font(BBFonts.displayMedium())
                    .foregroundColor(BBColors.text)

                Text("Pick one or more. Your feed will mix these reading lengths.")
                    .font(BBFonts.bodyMedium())
                    .foregroundColor(BBColors.textSecondary)
            }
            .padding(.top, BBSpacing.xl)

            VStack(spacing: BBSpacing.sm) {
                ForEach(ReadingTime.allCases) { time in
                    ReadingTimeOption(
                        time: time,
                        isSelected: viewModel.selectedReadingTimes.contains(time)
                    ) {
                        withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                            viewModel.toggleReadingTime(time)
                        }
                        UIImpactFeedbackGenerator(style: .light).impactOccurred()
                    }
                }
            }

            Spacer()
        }
        .padding(.horizontal, BBSpacing.lg)
    }

    // MARK: - Step 3: Sign Up

    private var signupStep: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: BBSpacing.lg) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Create your\naccount")
                        .font(BBFonts.displayMedium())
                        .foregroundColor(BBColors.text)

                    Text("Almost there! Sign up to save your preferences and start reading.")
                        .font(BBFonts.bodyMedium())
                        .foregroundColor(BBColors.textSecondary)
                }
                .padding(.top, BBSpacing.xl)

                // Form fields
                VStack(spacing: BBSpacing.md) {
                    BBTextField(
                        placeholder: "Display name",
                        text: $viewModel.displayName,
                        icon: "person"
                    )

                    BBTextField(
                        placeholder: "Email",
                        text: $viewModel.email,
                        icon: "envelope"
                    )

                    BBTextField(
                        placeholder: "Password (8+ characters)",
                        text: $viewModel.password,
                        isSecure: true,
                        icon: "lock"
                    )

                    if let error = viewModel.error {
                        Text(error)
                            .font(BBFonts.bodySmall())
                            .foregroundColor(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .transition(.opacity)
                    }
                }

                // Social sign-in divider
                HStack {
                    Rectangle().fill(BBColors.border).frame(height: 1)
                    Text("or").font(BBFonts.bodySmall()).foregroundColor(BBColors.textTertiary)
                    Rectangle().fill(BBColors.border).frame(height: 1)
                }
                .padding(.vertical, BBSpacing.xs)

                // Social auth
                VStack(spacing: BBSpacing.sm) {
                    SignInWithAppleButton(.signUp) { request in
                        request.requestedScopes = [.fullName, .email]
                    } onCompletion: { result in
                        handleAppleSignUp(result: result)
                    }
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 50)
                    .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))

                    GoogleSignInButton {
                        // Google Sign-In integration
                    }
                }
            }
            .padding(.horizontal, BBSpacing.lg)
            .padding(.bottom, BBSpacing.lg)
        }
    }

    // MARK: - Bottom Bar

    private var isLastStep: Bool {
        viewModel.currentStep == effectiveTotalSteps - 1
    }

    private var lastStepButtonTitle: String {
        isPostLogin ? "Get Started" : "Create Account"
    }

    private var bottomBar: some View {
        VStack(spacing: BBSpacing.sm) {
            // Navigation buttons
            HStack(spacing: BBSpacing.sm) {
                if viewModel.currentStep > 0 {
                    BBButton(title: "Back", style: .outline) {
                        viewModel.previousStep()
                    }
                }

                BBButton(
                    title: isLastStep ? lastStepButtonTitle : "Continue",
                    isLoading: viewModel.isSubmitting,
                    isDisabled: viewModel.isContinueDisabled
                ) {
                    if isLastStep {
                        if isPostLogin {
                            handleSavePreferences()
                        } else {
                            handleSignup()
                        }
                    } else {
                        viewModel.nextStep()
                    }
                }
            }

            // "Already have an account?" link — only when not logged in
            if !isPostLogin {
                Button {
                    authViewModel.showLogin = true
                } label: {
                    HStack(spacing: 4) {
                        Text("Already have an account?")
                            .foregroundColor(BBColors.textTertiary)
                        Text("Sign in")
                            .foregroundColor(BBColors.text)
                            .fontWeight(.semibold)
                    }
                    .font(BBFonts.bodyMedium())
                }
                .padding(.top, BBSpacing.xs)
            }
        }
        .padding(.horizontal, BBSpacing.lg)
        .padding(.bottom, BBSpacing.xl)
    }

    // MARK: - Actions

    private func handleSignup() {
        Task {
            if let response = await viewModel.registerAndSavePreferences() {
                authViewModel.handleFunnelCompletion(response: response)
            }
        }
    }

    /// For the post-login edge case: user is already authenticated, just save preferences.
    private func handleSavePreferences() {
        viewModel.isSubmitting = true
        Task {
            let success = await viewModel.savePreferencesOnly()
            if success {
                authViewModel.completeOnboarding()
            }
            viewModel.isSubmitting = false
        }
    }

    private func handleAppleSignUp(result: Result<ASAuthorization, Error>) {
        switch result {
        case .success(let authorization):
            if let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
               let identityTokenData = credential.identityToken,
               let identityToken = String(data: identityTokenData, encoding: .utf8) {

                let email = credential.email
                let fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
                    .compactMap { $0 }
                    .joined(separator: " ")

                Task {
                    do {
                        let response = try await APIService.shared.appleAuth(
                            identityToken: identityToken,
                            email: email,
                            fullName: fullName.isEmpty ? nil : fullName
                        )
                        // Save tokens first
                        KeychainService.shared.saveTokens(
                            accessToken: response.accessToken,
                            refreshToken: response.refreshToken
                        )
                        // Save the preferences they picked in the funnel
                        let _ = await viewModel.savePreferencesOnly()
                        authViewModel.handleFunnelCompletion(response: response)
                    } catch {
                        viewModel.error = error.localizedDescription
                    }
                }
            }
        case .failure(let error):
            viewModel.error = error.localizedDescription
        }
    }
}

// MARK: - Purpose Option

struct PurposeOption: View {
    let purpose: ReadingPurpose
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 14) {
                ZStack {
                    RoundedRectangle(cornerRadius: BBRadius.sm)
                        .fill(isSelected ? BBColors.primary : BBColors.gray100)
                        .frame(width: 44, height: 44)

                    Image(systemName: purpose.icon)
                        .font(.system(size: 18, weight: .medium))
                        .foregroundColor(isSelected ? BBColors.textInverse : BBColors.text)
                }

                VStack(alignment: .leading, spacing: 2) {
                    Text(purpose.rawValue)
                        .font(BBFonts.titleMedium())
                        .foregroundColor(BBColors.text)
                    Text(purpose.subtitle)
                        .font(BBFonts.bodySmall())
                        .foregroundColor(BBColors.textSecondary)
                }

                Spacer()

                Circle()
                    .fill(isSelected ? BBColors.primary : .clear)
                    .frame(width: 24, height: 24)
                    .overlay(
                        Circle()
                            .stroke(isSelected ? BBColors.primary : BBColors.border, lineWidth: 2)
                    )
                    .overlay(
                        isSelected ?
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white) : nil
                    )
            }
            .padding(BBSpacing.md)
            .background(isSelected ? BBColors.gray50 : BBColors.background)
            .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: BBRadius.md)
                    .stroke(isSelected ? BBColors.primary : BBColors.border, lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Category Chip

struct CategoryChip: View {
    let category: BookCategory
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: category.icon)
                    .font(.system(size: 14))
                Text(category.rawValue)
                    .font(BBFonts.bodyMedium())
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(isSelected ? BBColors.primary : BBColors.background)
            .foregroundColor(isSelected ? BBColors.textInverse : BBColors.text)
            .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: BBRadius.md)
                    .stroke(isSelected ? BBColors.primary : BBColors.border, lineWidth: 1.5)
            )
            .scaleEffect(isSelected ? 1.02 : 1.0)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Reading Time Option

struct ReadingTimeOption: View {
    let time: ReadingTime
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(time.label)
                        .font(BBFonts.titleMedium())
                        .foregroundColor(BBColors.text)
                    Text(time.description)
                        .font(BBFonts.bodySmall())
                        .foregroundColor(BBColors.textSecondary)
                }

                Spacer()

                Circle()
                    .fill(isSelected ? BBColors.primary : .clear)
                    .frame(width: 24, height: 24)
                    .overlay(
                        Circle()
                            .stroke(isSelected ? BBColors.primary : BBColors.border, lineWidth: 2)
                    )
                    .overlay(
                        isSelected ?
                        Image(systemName: "checkmark")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white) : nil
                    )
            }
            .padding(BBSpacing.md)
            .background(isSelected ? BBColors.gray50 : BBColors.background)
            .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: BBRadius.md)
                    .stroke(isSelected ? BBColors.primary : BBColors.border, lineWidth: isSelected ? 1.5 : 1)
            )
        }
        .buttonStyle(.plain)
    }
}
