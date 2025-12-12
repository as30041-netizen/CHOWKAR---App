
import { Job, JobStatus, User, UserRole, Bid, Transaction, Notification } from './types';

export const CATEGORIES = [
  'Farm Labor',
  'Construction',
  'Plumbing',
  'Electrical',
  'Driver',
  'Cleaning',
  'Delivery',
  'Other'
];

export const CATEGORY_TRANSLATIONS: Record<string, { en: string; hi: string }> = {
  'Farm Labor': { en: 'Farm Labor', hi: 'खेत मजदूरी' },
  'Construction': { en: 'Construction', hi: 'निर्माण / मिस्त्री' },
  'Plumbing': { en: 'Plumbing', hi: 'नल फिटिंग' },
  'Electrical': { en: 'Electrical', hi: 'बिजली काम' },
  'Driver': { en: 'Driver', hi: 'ड्राइवर' },
  'Cleaning': { en: 'Cleaning', hi: 'सफाई' },
  'Delivery': { en: 'Delivery', hi: 'डिलीवरी' },
  'Other': { en: 'Other', hi: 'अन्य' }
};

export const REVIEW_TAGS = [
  'Punctual',
  'Hardworking',
  'Skilled',
  'Polite',
  'Fast',
  'Safe',
  'Reliable'
];

export const REVIEW_TAGS_TRANSLATIONS: Record<string, Record<string, string>> = {
  'Punctual': { en: 'Punctual', hi: 'समयनिष्ठ' },
  'Hardworking': { en: 'Hardworking', hi: 'मेहनती' },
  'Skilled': { en: 'Skilled', hi: 'कुशल' },
  'Polite': { en: 'Polite', hi: 'विनम्र' },
  'Fast': { en: 'Fast', hi: 'तेज़' },
  'Safe': { en: 'Safe', hi: 'सुरक्षित' },
  'Reliable': { en: 'Reliable', hi: 'भरोसेमंद' }
};

export const TRANSLATIONS = {
  en: {
    // Auth
    signIn: "Sign In",
    joinTitle: "Join CHOWKAR",
    mobileNumber: "Mobile Number",
    getOtp: "Get OTP",
    otpSentTo: "Enter OTP sent to",
    verifyLogin: "Verify & Login",
    verifyRegister: "Verify & Register",
    createAccount: "Create Account",
    newHere: "New here?",
    alreadyHaveAccount: "Already have an account?",
    fullName: "Full Name",
    cityVillage: "City/Village Name",
    useGps: "Use My GPS Location",
    locationCaptured: "Location Captured!",
    
    // Navigation
    navHome: "Home",
    navPost: "Post",
    navWallet: "Wallet",
    navProfile: "Profile",
    
    // Header & Roles
    switchHiring: "Switch to Hiring",
    switchWorking: "Switch to Working",
    
    // Home
    jobsNearMe: "Jobs Near Me",
    myJobPosts: "My Job Posts",
    myApplications: "My Applications",
    searchWork: "Search work...",
    searchPosts: "Search your posts",
    myBids: "My Bids",
    allJobs: "All Jobs",
    filter: "Filter",
    noJobsFound: "No jobs found.",
    clearFilters: "Clear all filters",
    
    // Job Card & Details
    budget: "Budget",
    duration: "Duration",
    distance: "Distance",
    postedBy: "Posted By",
    bidNow: "Bid Now",
    viewBids: "View Bids",
    hired: "Hired",
    declined: "Declined",
    closed: "Closed",
    pending: "Pending",
    chat: "Chat",
    jobDescription: "Job Description",
    startDate: "Start Date",
    underBudget: "Under Budget",
    
    // Wallet
    totalBalance: "Total Balance",
    addMoney: "Add Money",
    transactionHistory: "Transaction History",
    bidHistory: "Bid History",
    noTransactions: "No transactions yet.",
    
    // Profile
    rating: "Rating",
    experience: "Experience",
    jobsDone: "Jobs Done",
    jobsPosted: "Jobs Posted",
    aboutMe: "About Me",
    skills: "Skills",
    contactInfo: "Contact Info",
    signOut: "Sign Out",
    editProfile: "Edit Profile",
    saveProfile: "Save Profile",
    changePhoto: "Change",
    tapToEdit: "Tap image to edit",
    reviews: "Reviews",
    
    // Post Job
    postJobHeader: "Post a New Job",
    jobTitleLabel: "Job Title",
    categoryLabel: "Category",
    descLabel: "Description",
    aiEnhance: "AI Enhance",
    postJobBtn: "Post Job Now",
    attachLocation: "Attach Job Location",
    editJob: "Edit Job",
    saveChanges: "Save Changes",
    aiEstimate: "AI Estimate",
    estimating: "Estimating...",

    // Alerts & Notifications
    alertGeoNotSupported: "Geolocation is not supported by your browser",
    alertGeoPermission: "Unable to retrieve your location. Please check permissions.",
    alertOtpSent: "OTP Sent to",
    alertInvalidMobile: "Please enter a valid mobile number",
    alertInvalidOtp: "Invalid OTP. Try 123456",
    alertFillFields: "Please fill in all fields.",
    alertInsufficientBalance: "Insufficient balance. Required: ₹",
    alertJobPosted: "Job posted successfully!",
    alertJobDeleted: "Job deleted successfully.",
    alertJobUpdated: "Job updated successfully!",
    alertBidPlaced: "Bid placed successfully!",
    alertCantEdit: "Cannot edit: Job has pending bids.",
    alertCantDeleteProgress: "Cannot delete a job that is currently in progress.",
    alertCantDeleteCompleted: "Cannot delete a completed job.",
    alertConfirmDelete: "Are you sure you want to delete this job?",
    alertBookingFee: "Booking Fee",
    
    notifWelcome: "Welcome to CHOWKAR!",
    notifWelcomeBody: "Start by finding a job or posting one.",
    notifJobPosted: "Job Posted",
    notifJobPostedBody: "Your job is now live!",
    notifBidReceived: "New Bid Received",
    notifBidAccepted: "Bid Accepted!",
    notifBidAcceptedBody: "Congratulations! Your bid was accepted.",
    notifBidRejected: "Bid Rejected",
    notifBidRejectedBody: "Your bid was declined.",
    notifJobCompleted: "Job Completed",
    notifWalletUpdated: "Wallet Updated",
    notifWalletUpdatedBody: "Money added successfully.",
    notifProfileUpdated: "Profile Updated",
    notifProfileUpdatedBody: "Your profile details have been successfully updated.",
    notifPremiumActivated: "Waitlist Joined",
    notifPremiumActivatedBody: "We'll notify you when Premium is ready!",
    notifCounterOffer: "New Counter Offer",
    
    congratulations: "Congratulations!",
    bidStatusUpdate: "Bid Status Update",
    bidNotSelected: "Your bid was not selected.",
    contactUnlocked: "Contact details unlocked.",
    markCompleted: "Mark Job as Completed",
    jobCompletedAlert: "Job marked as completed! Please rate your experience.",
    
    // Modals
    placeBid: "Place Your Bid",
    yourOffer: "Your Offer",
    msgToEmployer: "Message to Employer",
    sendBid: "Send Bid",
    reviewBids: "Review Bids",
    acceptFor: "Accept for",
    rejectBid: "Reject",
    counterOffer: "Counter",
    counterAmount: "New Amount",
    sendCounter: "Send Counter Offer",
    posterCountered: "Poster offered",
    youCountered: "You offered",
    acceptCounter: "Accept Offer",
    declineCounter: "Decline",
    waitingForResponse: "Waiting for response",
    lowestPrice: "Lowest Price",
    bestRated: "Best Rated",
    nearest: "Nearest",

    // Reviews
    rateExperience: "Rate your experience",
    howWasWork: "How was the work with",
    writeReviewPlaceholder: "Write a few words about the work...",
    submitReview: "Submit Review",
    skip: "Skip",
    reviewSubmitted: "Review Submitted!",
    compliments: "What went well?",

    // Premium - UPDATED FOR "COMING SOON"
    upgradePremium: "Premium Coming Soon",
    premiumDesc: "We are building professional tools for you.",
    premiumFeature1: "AI Job Description Enhancer",
    premiumFeature2: "AI Wage Estimator",
    premiumFeature3: "Verified Employer Badge",
    subscribeBtn: "Notify Me",
    premiumActive: "Premium Active",
    lockedFeature: "Locked",
    freeTriesLeft: "Free try left",
    planFree: "Free",
    planPremium: "Premium",
    featUnlimitedAI: "Unlimited AI Enhancements",
    featVerified: "Verified Badge",
    featPriority: "Priority Support",
    featLimitedAI: "2 Free AI Uses",
    featBasic: "Basic Profile",
    currentPlan: "Current Plan",
    bestValue: "Best Value"
  },
  hi: {
    // Auth
    signIn: "लॉग इन करें",
    joinTitle: "CHOWKAR से जुड़ें",
    mobileNumber: "मोबाइल नंबर",
    getOtp: "OTP भेजें",
    otpSentTo: "OTP यहाँ भेजा गया",
    verifyLogin: "वेरीफाई और लॉग इन",
    verifyRegister: "वेरीफाई और रजिस्टर",
    createAccount: "नया खाता बनाएं",
    newHere: "नये हैं?",
    alreadyHaveAccount: "पहले से खाता है?",
    fullName: "पूरा नाम",
    cityVillage: "शहर / गाँव",
    useGps: "मेरी लोकेशन (GPS) लें",
    locationCaptured: "लोकेशन मिल गई!",

    // Navigation
    navHome: "होम",
    navPost: "पोस्ट",
    navWallet: "वॉलेट",
    navProfile: "प्रोफाइल",

    // Header & Roles
    switchHiring: "काम दें (Hiring)",
    switchWorking: "काम खोजें (Working)",

    // Home
    jobsNearMe: "आस-पास के काम",
    myJobPosts: "मेरी पोस्ट",
    myApplications: "मेरे आवेदन",
    searchWork: "काम खोजें...",
    searchPosts: "अपनी पोस्ट खोजें",
    myBids: "मेरी बोलियाँ",
    allJobs: "सभी काम",
    filter: "फ़िल्टर",
    noJobsFound: "कोई काम नहीं मिला।",
    clearFilters: "फ़िल्टर हटायें",

    // Job Card & Details
    budget: "बजट",
    duration: "समय / अवधि",
    distance: "दूरी",
    postedBy: "पोस्ट करने वाला",
    bidNow: "बोली लगायें",
    viewBids: "बोलियाँ देखें",
    hired: "काम मिला",
    declined: "मना किया",
    closed: "बंद",
    pending: "लंबित",
    chat: "चैट करें",
    jobDescription: "काम का विवरण",
    startDate: "तारीख",
    underBudget: "बजट के अंदर",

    // Wallet
    totalBalance: "कुल बैलेंस",
    addMoney: "पैसे डालें",
    transactionHistory: "लेनदेन",
    bidHistory: "पुरानी बोलियाँ",
    noTransactions: "कोई लेनदेन नहीं।",

    // Profile
    rating: "रेटिंग",
    experience: "अनुभव",
    jobsDone: "काम किए",
    jobsPosted: "पोस्ट किए",
    aboutMe: "मेरे बारे में",
    skills: "हुनर / कौशल",
    contactInfo: "संपर्क",
    signOut: "साइन आउट",
    editProfile: "प्रोफाइल बदलें",
    saveProfile: "सेव करें",
    changePhoto: "बदलें",
    tapToEdit: "बदलने के लिए टैप करें",
    reviews: "समीक्षाएं (Reviews)",

    // Post Job
    postJobHeader: "नया काम पोस्ट करें",
    jobTitleLabel: "काम का नाम",
    categoryLabel: "श्रेणी",
    descLabel: "विवरण",
    aiEnhance: "AI सुधार",
    postJobBtn: "काम पोस्ट करें",
    attachLocation: "लोकेशन जोड़ें",
    editJob: "काम एडिट करें",
    saveChanges: "सेव करें",
    aiEstimate: "AI अनुमान",
    estimating: "अनुमान लगा रहे...",

    // Alerts & Notifications
    alertGeoNotSupported: "आपका ब्राउज़र लोकेशन सपोर्ट नहीं करता।",
    alertGeoPermission: "लोकेशन नहीं मिली। कृपया परमिशन दें।",
    alertOtpSent: "OTP भेजा गया",
    alertInvalidMobile: "कृपया सही मोबाइल नंबर डालें",
    alertInvalidOtp: "गलत OTP. 123456 ट्राय करें",
    alertFillFields: "कृपया सभी जानकारी भरें।",
    alertInsufficientBalance: "बैलेंस कम है। कम से कम चाहिए: ₹",
    alertJobPosted: "काम सफलतापूर्वक पोस्ट किया गया!",
    alertJobDeleted: "काम हटा दिया गया।",
    alertJobUpdated: "काम अपडेट किया गया!",
    alertBidPlaced: "बोली सफलतापूर्वक लगाई गई!",
    alertCantEdit: "अभी एडिट नहीं कर सकते: लोगों ने बोली लगाई है।",
    alertCantDeleteProgress: "चल रहे काम को हटा नहीं सकते।",
    alertCantDeleteCompleted: "पूरे हो चुके काम को हटा नहीं सकते।",
    alertConfirmDelete: "क्या आप यह काम हटाना चाहते हैं?",
    alertBookingFee: "बुकिंग फीस",

    notifWelcome: "CHOWKAR में स्वागत है!",
    notifWelcomeBody: "काम ढूँढना या पोस्ट करना शुरू करें।",
    notifJobPosted: "काम पोस्ट हुआ",
    notifJobPostedBody: "आपका काम लाइव है!",
    notifBidReceived: "नई बोली मिली",
    notifBidAccepted: "बधाई हो!",
    notifBidAcceptedBody: "आपकी बोली स्वीकार कर ली गई।",
    notifBidRejected: "बोली अस्वीकार",
    notifBidRejectedBody: "आपकी बोली स्वीकार नहीं हुई।",
    notifJobCompleted: "काम पूरा हुआ",
    notifWalletUpdated: "वॉलेट अपडेट",
    notifWalletUpdatedBody: "पैसे सफलतापूर्वक जोड़े गए।",
    notifProfileUpdated: "प्रोफाइल अपडेट हो गई",
    notifProfileUpdatedBody: "आपकी जानकारी सफलतापूर्वक अपडेट हो गई।",
    notifPremiumActivated: "वेटलिस्ट में शामिल हुए",
    notifPremiumActivatedBody: "प्रीमियम तैयार होने पर हम आपको सूचित करेंगे!",
    notifCounterOffer: "नया प्रस्ताव (Counter Offer)",

    congratulations: "बधाई हो!",
    bidStatusUpdate: "बोली अपडेट",
    bidNotSelected: "आपकी बोली नहीं चुनी गई।",
    contactUnlocked: "संपर्क नंबर मिल गया है।",
    markCompleted: "काम पूरा हुआ (Mark Completed)",
    jobCompletedAlert: "काम पूरा हुआ! कृपया अपना अनुभव साझा करें।",

    // Modals
    placeBid: "अपनी बोली लगायें",
    yourOffer: "आपकी रकम (₹)",
    msgToEmployer: "संदेश",
    sendBid: "बोली भेजें",
    reviewBids: "बोलियाँ देखें",
    acceptFor: "मंजूर करें: ₹",
    rejectBid: "अस्वीकार",
    counterOffer: "मोलभाव (Counter)",
    counterAmount: "नया दाम",
    sendCounter: "प्रस्ताव भेजें",
    posterCountered: "मालिक का प्रस्ताव",
    youCountered: "आपका प्रस्ताव",
    acceptCounter: "प्रस्ताव स्वीकार करें",
    declineCounter: "अस्वीकार",
    waitingForResponse: "जवाब का इंतज़ार",
    lowestPrice: "सबसे सस्ता",
    bestRated: "सबसे अच्छा",
    nearest: "सबसे पास",

    // Reviews
    rateExperience: "अपना अनुभव रेट करें",
    howWasWork: "इनके साथ काम कैसा रहा",
    writeReviewPlaceholder: "काम के बारे में कुछ शब्द लिखें...",
    submitReview: "रिव्यु जमा करें",
    skip: "छोड़ें",
    reviewSubmitted: "रिव्यु जमा हो गया!",
    compliments: "क्या अच्छा रहा?",

    // Premium - UPDATED FOR "COMING SOON"
    upgradePremium: "प्रीमियम जल्द आ रहा है",
    premiumDesc: "हम आपके लिए प्रोफेशनल टूल्स बना रहे हैं।",
    premiumFeature1: "AI विवरण सुधार (AI Enhancer)",
    premiumFeature2: "AI मजदूरी अनुमान (AI Wage Estimator)",
    premiumFeature3: "सत्यापित बैज (Verified Badge)",
    subscribeBtn: "मुझे सूचित करें",
    premiumActive: "प्रीमियम चालू है",
    lockedFeature: "लॉक है",
    freeTriesLeft: "फ्री ट्रायल बचा है",
    planFree: "फ्री प्लान",
    planPremium: "प्रीमियम प्लान",
    featUnlimitedAI: "अनलिमिटेड AI सुधार",
    featVerified: "सत्यापित (Verified) बैज",
    featPriority: "प्राथमिकता सहायता",
    featLimitedAI: "2 बार फ्री AI उपयोग",
    featBasic: "बेसिक प्रोफाइल",
    currentPlan: "वर्तमान प्लान",
    bestValue: "सबसे अच्छा"
  }
};

export const POSTER_FEE = 19; // Fixed fee for hiring a worker
export const WORKER_COMMISSION_RATE = 0.05; // 5% commission on bid amount
export const FREE_AI_USAGE_LIMIT = 2; // Number of free AI uses allowed

// Mock location: Center of Nagpur
export const MOCK_USER: User = {
  id: 'u1',
  name: 'Rajesh Kumar',
  email: 'rajesh@example.com',
  phone: '+91 98765 43210',
  location: 'Nagpur, Maharashtra',
  coordinates: { lat: 21.1458, lng: 79.0882 },
  walletBalance: 500,
  rating: 4.8,
  // profilePhoto: 'https://randomuser.me/api/portraits/men/32.jpg', // Example valid URL if needed
  isPremium: false,
  aiUsageCount: 0,
  bio: 'Hardworking individual with experience in agricultural and construction tasks. Reliable, punctual, and always ready to learn new skills.',
  skills: ['Tractor Driving', 'Harvesting', 'Heavy Lifting', 'Basic Carpentry'],
  experience: '5 Years',
  jobsCompleted: 14,
  joinDate: Date.now() - 31536000000, // Approx 1 year ago
  reviews: [
    {
      id: 'r1',
      reviewerId: 'u2',
      reviewerName: 'Amit Singh',
      rating: 5,
      comment: 'Rajesh was extremely helpful with the rice harvest. Very hardworking and polite.',
      tags: ['Hardworking', 'Polite'],
      date: Date.now() - 864000000 // 10 days ago
    },
    {
      id: 'r2',
      reviewerId: 'u3',
      reviewerName: 'Suresh Patil',
      rating: 4,
      comment: 'Good driving skills, arrived on time.',
      tags: ['Punctual', 'Skilled'],
      date: Date.now() - 1728000000 // 20 days ago
    }
  ]
};

export const MOCK_JOBS: Job[] = [
  {
    id: 'j1',
    posterId: 'u1', // CHANGED TO CURRENT USER (RAJESH) FOR DEMO
    posterName: 'Rajesh Kumar', // CHANGED TO CURRENT USER
    posterPhone: '+91 98765 43210',
    title: 'Need help with Rice Harvest',
    description: 'Looking for 3 people to help with rice harvesting in my field for 2 days. Lunch provided.',
    category: 'Farm Labor',
    location: 'Wardha, MH',
    coordinates: { lat: 20.7453, lng: 78.6022 }, // ~50km from Nagpur
    jobDate: '2024-11-20',
    duration: '2 Days',
    budget: 1200,
    status: JobStatus.OPEN,
    createdAt: Date.now() - 86400000,
    bids: []
  },
  {
    id: 'j2',
    posterId: 'u3',
    posterName: 'Suresh Patil',
    posterPhone: '+91 88776 65544',
    title: 'Tempo Driver Needed',
    description: 'Need a driver to transport goods from village to city market. Must have license.',
    category: 'Driver',
    location: 'Nagpur, MH',
    coordinates: { lat: 21.1460, lng: 79.0885 }, // Very close to user
    jobDate: '2024-10-25',
    duration: '8 Hours',
    budget: 800,
    status: JobStatus.OPEN,
    createdAt: Date.now() - 172800000,
    bids: [
      {
        id: 'b1',
        jobId: 'j2',
        workerId: 'u1', // Current user bid on this
        workerName: 'Rajesh Kumar',
        workerPhone: '+91 98765 43210',
        workerRating: 4.5,
        workerLocation: 'Nagpur, Maharashtra',
        workerCoordinates: { lat: 21.1458, lng: 79.0882 },
        amount: 750,
        message: 'I have 5 years heavy vehicle experience.',
        createdAt: Date.now() - 100000,
        status: 'PENDING',
        negotiationHistory: [
             { amount: 750, by: UserRole.WORKER, timestamp: Date.now() - 100000 }
        ]
      }
    ]
  },
  {
    id: 'j3',
    posterId: 'u1', // Current user posted this
    posterName: 'Rajesh Kumar',
    posterPhone: '+91 98765 43210',
    title: 'Fix Water Pump',
    description: 'Submersible pump not starting. Need electrician urgently.',
    category: 'Electrical',
    location: 'Nagpur, MH',
    coordinates: { lat: 21.1458, lng: 79.0882 },
    jobDate: '2024-10-24',
    duration: '2 Hours',
    budget: 500,
    status: JobStatus.OPEN,
    createdAt: Date.now() - 400000,
    // REMOVED BIDS SO EDIT BUTTON SHOWS
    bids: []
  }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 't1',
    userId: 'u1',
    amount: 500,
    type: 'CREDIT',
    description: 'Added money to wallet',
    timestamp: Date.now() - 100000000
  },
  {
    id: 't2',
    userId: 'u1',
    amount: 15,
    type: 'DEBIT',
    description: 'Platform Fee: Tempo Driver Bid',
    timestamp: Date.now() - 86400000
  }
];

export const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    userId: 'u1',
    title: 'Welcome to CHOWKAR',
    message: 'Get started by finding work or posting a job.',
    type: 'INFO',
    read: false,
    timestamp: Date.now() - 10000000
  }
];
