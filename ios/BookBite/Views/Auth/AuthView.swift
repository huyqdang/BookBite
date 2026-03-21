import SwiftUI
import AuthenticationServices

/// Login-only screen. Shown when user taps "Already have an account?" from the funnel.
struct AuthView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var email = ""
    @State private var password = ""
    @State private var appeared = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Spacer(minLength: 60)

                // Logo
                VStack(spacing: 8) {
                    Image(systemName: "book.closed.fill")
                        .font(.system(size: 40))
                        .foregroundColor(BBColors.primary)

                    Text("BookBite")
                        .font(BBFonts.displayLarge())

                    Text("Welcome back")
                        .font(BBFonts.bodyMedium())
                        .foregroundColor(BBColors.textTertiary)
                }
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 20)
                .padding(.bottom, BBSpacing.xxl)

                // Form
                VStack(spacing: BBSpacing.md) {
                    BBTextField(
                        placeholder: "Email",
                        text: $email,
                        icon: "envelope"
                    )

                    BBTextField(
                        placeholder: "Password",
                        text: $password,
                        isSecure: true,
                        icon: "lock"
                    )

                    if let error = authViewModel.error {
                        Text(error)
                            .font(BBFonts.bodySmall())
                            .foregroundColor(.red)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .transition(.opacity)
                    }

                    BBButton(
                        title: "Sign In",
                        isLoading: false,
                        isDisabled: email.isEmpty || password.isEmpty
                    ) {
                        Task {
                            await authViewModel.login(email: email, password: password)
                        }
                    }
                }
                .padding(.horizontal, BBSpacing.lg)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 30)

                // Divider
                HStack {
                    Rectangle().fill(BBColors.border).frame(height: 1)
                    Text("or").font(BBFonts.bodySmall()).foregroundColor(BBColors.textTertiary)
                    Rectangle().fill(BBColors.border).frame(height: 1)
                }
                .padding(.horizontal, BBSpacing.lg)
                .padding(.vertical, BBSpacing.lg)
                .opacity(appeared ? 1 : 0)

                // Social Sign-In
                VStack(spacing: BBSpacing.sm) {
                    SignInWithAppleButton(.signIn) { request in
                        request.requestedScopes = [.fullName, .email]
                    } onCompletion: { result in
                        authViewModel.handleAppleSignIn(result: result)
                    }
                    .signInWithAppleButtonStyle(.black)
                    .frame(height: 50)
                    .clipShape(RoundedRectangle(cornerRadius: BBRadius.md))

                    GoogleSignInButton {
                        // Google Sign-In integration
                    }
                }
                .padding(.horizontal, BBSpacing.lg)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 20)

                // Back to signup funnel
                Button {
                    withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                        authViewModel.showLogin = false
                        authViewModel.error = nil
                    }
                } label: {
                    HStack(spacing: 4) {
                        Text("Don't have an account?")
                            .foregroundColor(BBColors.textTertiary)
                        Text("Sign up")
                            .foregroundColor(BBColors.text)
                            .fontWeight(.semibold)
                    }
                    .font(BBFonts.bodyMedium())
                }
                .padding(.top, BBSpacing.lg)
                .padding(.bottom, BBSpacing.xxl)
            }
        }
        .background(BBColors.background)
        .onAppear {
            withAnimation(.easeOut(duration: 0.6).delay(0.1)) {
                appeared = true
            }
        }
    }
}
