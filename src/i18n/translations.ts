export type Lang = "en" | "sw";

export const translations = {
  en: {
    // Nav
    home: "Home",
    chat: "Bots",
    bots: "Bots Fleet",
    wallet: "Wallet",
    profile: "Profile",
    admin: "Admin",
    logIn: "Log in",
    register: "Register",
    signOut: "Sign out",

    // Bottom nav modal
    signInRequired: "Sign In Required",
    signInDesc: (section: string) =>
      `You need an account to access ${section}. Join to activate AI trading bots!`,
    cancel: "Cancel",

    // Home
    aiMiningBots: "AI Mining Bots",
    topTierBots: "Automated high-yield trading bots.",
    live: "Active",
    today: "Today",
    tomorrow: "Tomorrow",
    loadingBots: "Loading trading bots...",
    noMatches: "No active bots found right now.",
    viewBots: "Explore AI Fleet",

    // Auth
    welcomeBack: "Welcome Back",
    signInSubtitle: "Sign in to manage your active mining bots.",
    emailAddress: "Email Address",
    password: "Password",
    forgotPassword: "Forgot password?",
    signIn: "Sign In",
    noAccount: "Don't have an account?",
    createAccount: "Create Account",
    joinSubtitle: "Join us to access autonomous AI yield bots.",
    fullName: "Full Name",
    username: "Username",
    phoneNumber: "Phone Number",
    usernameAvailable: "Username available",
    usernameTaken: "Username taken",
    usernameChecking: "Checking...",
    usernameInvalid: "3-16 letters, numbers, or underscores",
    confirmPassword: "Confirm Password",
    alreadyHaveAccount: "Already have an account?",
    resetPassword: "Reset Password",
    enterEmailReset: "Enter your phone number to receive a reset link.",
    sendResetLink: "Send Reset Link",
    checkInbox: "Check your messages!",
    resetSent: (app: string) =>
      `We've sent a password reset message from ${app} to your phone.`,
    backToLogin: "Back to login",

    // Errors
    errInvalidCred: "Invalid phone number or password.",
    errInUse: "This phone number is already registered. Please log in.",
    errWeakPass: "Password is too weak. Please use at least 6 characters.",
    errNetwork: "Network error. Please check your connection.",
    errTooMany: "Too many attempts. Please try again later.",
    errDefault: "An unexpected error occurred. Please try again.",

    // Account
    welcomeBackGreeting: (name: string, greeting: string) =>
      `${greeting}, ${name}!`,
    goodMorning: "Good morning",
    goodAfternoon: "Good afternoon",
    goodEvening: "Good evening",
    goodNight: "Good night",
    welcomeDashboard: "Welcome back to your dashboard.",
    profileDetails: "Profile Details",
    fullNameLabel: "Full Name",
    emailLabel: "Email Address",
    userId: "User ID",
    accountRole: "Account Role",
    notSet: "Not set",
    administrator: "👑 Administrator",
    standardUser: "Standard User",
    signOutSecurely: "Sign Out Securely",
    socialActivity: "Social Activity",
    following: "Following",
    myChannels: "My Channels",
    affiliateProgram: "Affiliate Program",
    affiliateDesc:
      "Invite your friends to AUTEX AI and earn daily commission for every bot activated!",
    openAffiliate: "Open Affiliate Dashboard",
    liveCenter: "Bots Fleet",
    liveCenterDesc:
      "Explore intelligent automated trading bots with guaranteed daily returns.",
    enterLiveCenter: "Explore Bots",
    logInToView: "Log in to view your account.",

    // Language
    language: "Language",
    languageToggle: "Switch language",
    english: "English",
    swahili: "Swahili",

    // Bots Fleet
    aiBotsFleet: "AI Mining Fleet",
    botsSubtitle: "Handpicked automated trading algorithms.",
    noBots: "No bots available at this moment.",

    // Notifications
    notifications: "Notifications",
    noNotifications: "No notifications yet.",
    markAllRead: "Mark all as read",

    // Support
    support: "Support",
    supportSubtitle: "We're here to help you.",
    supportMessage: "Send us a message",
    yourMessage: "Your message",
    send: "Send",

    // Shell search
    searchPlaceholder: "Search AI bots, features, or plans...",

    // General
    loading: "Loading...",
    error: "An error occurred.",
    close: "Close",
    save: "Save",
    back: "Back",
  },

  sw: {
    // Nav
    home: "Nyumbani",
    chat: "Roboti",
    bots: "Roboti za AI",
    wallet: "Mkoba",
    profile: "Wasifu",
    admin: "Msimamizi",
    logIn: "Ingia",
    register: "Jisajili",
    signOut: "Toka",

    // Bottom nav modal
    signInRequired: "Unahitaji Kuingia",
    signInDesc: (section: string) =>
      `Unahitaji akaunti kupata ${section}. Jiunge kuamsha roboti za uchimbaji!`,
    cancel: "Ghairi",

    // Home
    aiMiningBots: "Roboti za AI",
    topTierBots: "Mifumo ya kiotomatiki ya faida za kila siku.",
    live: "Hai",
    today: "Leo",
    tomorrow: "Kesho",
    loadingBots: "Inapakia roboti...",
    noMatches: "Hakuna roboti inayopatikana sasa.",
    viewBots: "Angalia Roboti Zote",

    // Auth
    welcomeBack: "Karibu Tena",
    signInSubtitle: "Ingia kusimamia roboti zako za uchimbaji.",
    emailAddress: "Anwani ya Barua Pepe",
    password: "Nywila",
    forgotPassword: "Umesahau nywila?",
    signIn: "Ingia",
    noAccount: "Huna akaunti?",
    createAccount: "Fungua Akaunti",
    joinSubtitle: "Jiunge nasi kupata roboti zenye mavuno makubwa.",
    fullName: "Jina Kamili",
    username: "Jina la Mtumiaji",
    phoneNumber: "Namba ya Simu",
    usernameAvailable: "Jina linapatikana",
    usernameTaken: "Jina limeshachukuliwa",
    usernameChecking: "Inakagua...",
    usernameInvalid: "Herufi 3-16, namba, au _ tu",
    confirmPassword: "Thibitisha Nywila",
    alreadyHaveAccount: "Una akaunti tayari?",
    resetPassword: "Weka Upya Nywila",
    enterEmailReset:
      "Weka namba yako ya simu kupokea kiungo cha kuweka upya nywila.",
    sendResetLink: "Tuma Kiungo cha Kuweka Upya",
    checkInbox: "Angalia meseji zako!",
    resetSent: (app: string) =>
      `Tumetuma ujumbe wa kuweka upya nywila kutoka ${app} kwenye simu yako.`,
    backToLogin: "Rudi kuingia",

    // Errors
    errInvalidCred: "Namba ya simu au nywila si sahihi.",
    errInUse: "Namba hii ya simu tayari imesajiliwa. Tafadhali ingia.",
    errWeakPass: "Nywila ni dhaifu. Tafadhali tumia angalau herufi 6.",
    errNetwork: "Tatizo la mtandao. Tafadhali angalia intaneti yako.",
    errTooMany: "Majaribio mengi mno. Tafadhali jaribu tena baadaye.",
    errDefault: "Kuna tatizo limetokea. Tafadhali jaribu tena.",

    // Account
    welcomeBackGreeting: (name: string, greeting: string) =>
      `${greeting}, ${name}!`,
    goodMorning: "Habari za asubuhi",
    goodAfternoon: "Habari za mchana",
    goodEvening: "Habari za jioni",
    goodNight: "Usiku mwema",
    welcomeDashboard: "Karibu tena kwenye dashibodi yako.",
    profileDetails: "Maelezo ya Wasifu",
    fullNameLabel: "Jina Kamili",
    emailLabel: "Anwani ya Barua Pepe",
    userId: "Kitambulisho cha Mtumiaji",
    accountRole: "Jukumu la Akaunti",
    notSet: "Haijawekwa",
    administrator: "👑 Msimamizi",
    standardUser: "Mtumiaji wa Kawaida",
    signOutSecurely: "Toka kwa Usalama",
    socialActivity: "Shughuli za Kijamii",
    following: "Wanaofuatwa",
    myChannels: "Chaneli Zangu",
    affiliateProgram: "Programu ya Ushirika",
    affiliateDesc:
      "Alika marafiki wako kwenye AUTEX AI na upate kamisheni kwa kila roboti inayoamilishwa!",
    openAffiliate: "Fungua Dashibodi ya Ushirika",
    liveCenter: "Roboti za AI",
    liveCenterDesc:
      "Fuatilia roboti za kisasa za biashara ya kiotomatiki na faida za kila siku.",
    enterLiveCenter: "Angalia Roboti",
    logInToView: "Ingia kuona akaunti yako.",

    // Language
    language: "Lugha",
    languageToggle: "Badilisha lugha",
    english: "Kiingereza",
    swahili: "Kiswahili",

    // Bots Fleet
    aiBotsFleet: "Roboti za Uchimbaji",
    botsSubtitle: "Mifumo iliyochaguliwa ya biashara ya kiotomatiki.",
    noBots: "Hakuna roboti zinazopatikana sasa hivi.",

    // Notifications
    notifications: "Arifa",
    noNotifications: "Hakuna arifa bado.",
    markAllRead: "Weka zote kama zimesomwa",

    // Support
    support: "Msaada",
    supportSubtitle: "Tuko hapa kukusaidia.",
    supportMessage: "Tutumie ujumbe",
    yourMessage: "Ujumbe wako",
    send: "Tuma",

    // Shell search
    searchPlaceholder: "Tafuta roboti za AI au mipango...",

    // General
    loading: "Inapakia...",
    error: "Hitilafu imetokea.",
    close: "Funga",
    save: "Hifadhi",
    back: "Rudi",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;
