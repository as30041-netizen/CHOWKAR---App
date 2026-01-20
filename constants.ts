
import { Job, JobStatus, User, UserRole, Bid, Notification } from './types';

import { Share2, Truck, Wrench, Zap, Car, Sparkles, HardHat, Shovel } from 'lucide-react';

export interface CategoryConfig {
  id: string;
  label: { en: string; hi: string; pa: string };
  icon: any; // Lucide icon
  color: string; // Tailwind gradient classes
  bg: string; // Solid bg for badges
  image?: string; // Path to realistic image
}

export const CATEGORY_CONFIG: CategoryConfig[] = [
  {
    id: 'Farm Labor',
    label: { en: 'Farm Labor', hi: 'खेती-बाड़ी', pa: 'ਖੇਤੀਬਾੜੀ' },
    icon: Shovel,
    color: 'from-green-400 to-emerald-600',
    bg: 'bg-emerald-100 text-emerald-800',
    image: '/assets/categories/farm.png'
  },
  {
    id: 'Construction',
    label: { en: 'Construction', hi: 'निर्माण / मिस्त्री', pa: 'ਉਸਾਰੀ / ਮਿਸਤਰੀ' },
    icon: HardHat,
    color: 'from-orange-400 to-red-500',
    bg: 'bg-orange-100 text-orange-800',
    image: '/assets/categories/construction.png'
  },
  {
    id: 'Driver',
    label: { en: 'Driver', hi: 'ड्राइवर', pa: 'ਡਰਾਈਵਰ' },
    icon: Car,
    color: 'from-blue-400 to-indigo-600',
    bg: 'bg-blue-100 text-blue-800',
    image: '/assets/categories/driver.png'
  },
  {
    id: 'Cleaning',
    label: { en: 'Cleaning', hi: 'सफाई', pa: 'ਸਫ਼ਾਈ' },
    icon: Sparkles,
    color: 'from-teal-300 to-cyan-500',
    bg: 'bg-cyan-100 text-cyan-800',
    image: '/assets/categories/cleaning.png'
  },
  {
    id: 'Plumbing',
    label: { en: 'Plumbing', hi: 'नल फिटिंग', pa: 'ਪਲੰਬਿੰਗ' },
    icon: Wrench,
    color: 'from-sky-400 to-blue-600',
    bg: 'bg-sky-100 text-sky-800',
    image: '/assets/categories/plumbing.png'
  },
  {
    id: 'Electrical',
    label: { en: 'Electrical', hi: 'बिजली काम', pa: 'ਬਿਜਲੀ ਦਾ ਕੰਮ' },
    icon: Zap,
    color: 'from-yellow-400 to-amber-500',
    bg: 'bg-yellow-100 text-yellow-800',
    image: '/assets/categories/electrical.png'
  },
  {
    id: 'Delivery',
    label: { en: 'Delivery', hi: 'डिलीवरी', pa: 'ਡਿਲੀਵਰੀ' },
    icon: Truck,
    color: 'from-fuchsia-400 to-purple-600',
    bg: 'bg-purple-100 text-purple-800',
    image: '/assets/categories/delivery.png'
  },
  {
    id: 'Other',
    label: { en: 'Other', hi: 'अन्य', pa: 'ਹੋਰ' },
    icon: Share2,
    color: 'from-gray-400 to-slate-500',
    bg: 'bg-gray-100 text-gray-800',
    image: '/assets/categories/other.png'
  }
];

// Helper to keep backward compatibility with array-based usage
export const CATEGORIES = CATEGORY_CONFIG.map(c => c.id);

export const CATEGORY_TRANSLATIONS: Record<string, { en: string; hi: string; pa: string }> = CATEGORY_CONFIG.reduce((acc, curr) => ({
  ...acc,
  [curr.id]: curr.label
}), {});

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

const EN_TRANSLATIONS = {
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
  accept: "Accept",
  counter: "Counter",
  hired: "Hired",
  declined: "Declined",
  closed: "Closed",
  pending: "Pending",
  chat: "Chat",
  translate: "Translate",
  translating: "Translating...",
  showOriginal: "Show Original",
  translateError: "Translation failed",
  jobDescription: "Job Description",
  startDate: "Start Date",
  postedDate: "Posted Date",
  appliedOn: "Applied On",
  proposedBudget: "Your Proposed Budget",
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
  waitingForPosterFinalize: "Offer accepted! Waiting for Employer to finalize.",
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
  bidMessagePlaceholder: "Describe your proposal...",

  // Info Modals
  infoGuide: "Platform Guide",
  gotIt: "Got it, Thanks",
  safetyTitle: "Safety Rules",
  securityAlert: "Security Alert",
  securityDesc: "Never share OTPs or passwords. CHOWKAR will NEVER ask for them under any circumstances.",
  essentialGuidelines: "Essential Guidelines",
  ruleInAppPayments: "In-App Payments",
  ruleInAppPaymentsDesc: "Always use our secure wallet for all job payments to stay protected by our system.",
  ruleVerifyProfiles: "Verify Profiles",
  ruleVerifyProfilesDesc: "Ensure the face matches the profile photo. Don't hesitate to ask for ID verification.",
  ruleStayInChat: "Stay in Chat",
  ruleStayInChatDesc: "Don't move to WhatsApp or calls. In-app chats are recorded for your own safety.",
  ruleReportAbuse: "Report Abuse",
  ruleReportAbuseDesc: "If someone asks for upfront fees or behaves suspiciously, report them instantly.",
  verifyLocation: "Verify Location",
  verifyLocationDesc: "Check the map & distance before heading out.",
  publicPlaces: "Public Places",
  publicPlacesDesc: "Meet in well-lit, busy areas for first contact.",
  fixedRates: "Fixed Rates",
  fixedRatesDesc: "Ensure the budget is locked before starting.",
  idValidation: "ID Validation",
  idValidationDesc: "Request Govt ID before allowing inside.",
  workScope: "Work Scope",
  workScopeDesc: "Give precise, clear instructions via chat.",
  fairConduct: "Fair Conduct",
  fairConductDesc: "Show empathy & provide water for hard labor.",

  guidelinesTitle: "Guidelines",
  guidelinesDesc: "CHOWKAR is built on trust. To keep our marketplace safe, please adhere to these core principles:",
  respectTitle: "Respect Everyone",
  respectDesc: "No abusive language, discrimination, or harassment. Treat everyone with dignity.",
  reliableTitle: "Be Reliable",
  reliableDesc: "If you accept, show up. If you hire, provide clear instructions and pay firmly on time.",
  honestReviews: "Honest Reviews",
  honestReviewsDesc: "Leave genuine ratings based on performance. Do not use ratings as a bargaining tool.",
  safetyFirst: "Safety First",
  safetyFirstDesc: "Soliciting illegal activities will result in an immediate permanent ban.",

  termsTitle: "Terms",
  lastUpdated: "Last Updated",
  termsIntro: "By using CHOWKAR, you agree to these simplified terms:",
  termRole: "Platform Role",
  termRoleDesc: "We are an intermediary connecting users. We don't employ workers.",
  termPayments: "Payments",
  termPaymentsDesc: "Use our wallet for safety. We are not liable for cash-only disputes.",
  termPrivacy: "Data Privacy",
  termPrivacyDesc: "We use location only to find nearby work. We NEVER sell your data.",
  termTermination: "Termination",
  termTerminationDesc: "Violating guidelines will result in an immediate account ban.",
  termsSummary: "This contains a summary. For full legal text, please contact legal@chowkar.in",

  // Reviews
  rateExperience: "Rate your experience",
  howWasWork: "How was the work with",
  writeReviewPlaceholder: "Write a few words about the work...",
  submitReview: "Submit Review",
  skip: "Skip",
  reviewSubmitted: "Review Submitted!",
  compliments: "What went well?",

  // Premium
  upgradePremium: "Upgrade to Premium",
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
  bestValue: "Best Value",

  // New Wallet/Bid Translatons
  commissionCredits: "Commission Credits",
  addCredits: "Add Credits",
  withdraw: "Withdraw",
  yourOfferLabel: "Your Offer",
  noBidsFound: "No bids found.",
  noBidsDesc: "Your job applications will appear here once you start bidding.",
  acceptingBidFeeWarn: "Accepting this bid will deduct a ₹{fee} platform fee from your wallet. Continue?",

  // Payment Modal
  secureCheckout: "Secure Checkout",
  publishJob: "Publish Job",
  unlockChat: "Unlock Chat",
  addFunds: "Add Funds",
  paymentSuccessful: "Payment Successful!",
  paymentSecureDesc: "Your transaction was completed securely.",
  paymentFailed: "Payment Failed",
  tryAgain: "Try Again",
  totalPayable: "Total Amount Payable",
  encryptedGateway: "Encrypted Gateway",
  securedBy: "Secured by Razorpay & SSL Protocol",
  processingTransaction: "Processing Transaction...",
  payNow: "Pay ₹{amount} Now",

  // Landing Page
  heroTitle: "Find Work. Hire Locally. Zero Commission.",
  heroSubtitle: "Connect directly with trusted workers and employers in your village or town. No middlemen, no hidden fees.",
  heroBtnWorker: "Find Work",
  heroBtnPoster: "Get Started Free",
  popularServices: "Popular Services",
  popularServicesDesc: "Find help for any task, anytime.",
  successStories: "Success Stories",
  successStoriesDesc: "Real people, real earnings.",
  howItWorks: "How It Works",
  watchVideo: "Watch Video Guide",
  faqTitle: "Frequently Asked Questions",
  downloadApp: "Download Android App (APK)",
  forEmployers: "For Employers",
  forWorkers: "For Workers",
  employerDesc: "Hire skilled drivers, farm laborers, maids, and construction workers instantly.",
  workerDesc: "Find daily wage jobs near you. Get paid directly by the employer. No commission.",
  postJobNow: "Post a Job Now",
  createProfile: "Create Worker Profile",

  // Home - Mode Switcher
  findWork: "Find Work",
  hireMyJobs: "Hire / My Jobs",
  myJobDashboard: "My Job Dashboard",
  all: "All Jobs",
  open: "Open",
  active: "Active",
  done: "Done",
  loadMore: "Load More Jobs",
  loading: "Loading...",

  // Validation
  alertInvalidAmount: "Please enter a valid amount greater than ₹0",

  // Lists
  bidsReceived: "Bids Received",
  viewAll: "View All",
  moreBids: "more bids",

  // App Errors & Success
  chatReceiverError: "Error: Cannot determine who to send message to.",
  jobCompletionError: "Failed to complete job",
  genericError: "Failed: ",
  withdrawBidError: "Error withdrawing bid",
  jobCancelledRefunded: "Job cancelled and funds refunded.",
  cancelError: "Failed to cancel",
  cancellationError: "Error during cancellation",
  paymentSuccessChat: "Payment successful! Chat unlocked.",

  // Common Actions
  cancel: "Cancel",
  delete: "Delete",
  stop: "Stop",
  voice: "Voice",
  uploading: "Uploading...",

  // Notifications Panel
  markRead: "Mark Read",
  clearAll: "Clear All",
  clearAllPrompt: "Clear all notifications?",
  noNotifications: "No notifications yet",

  // Job Posting Form
  updateJob: "Update Job",
  postJobWithFee: "Post Job (₹{fee})",
  walletUsageDisclaimer: "Will use ₹{fee} from wallet (Balance: ₹{balance})",
  uploadingImage: "Uploading image...",
  jobPostedDeduction: "Job posted! ₹{fee} deducted from wallet.",
  photoAnalyzed: "Details updated based on your photo.",
  analyzeAi: "Analyze with AI",
  addPhoto: "Add Photo",
  enhancing: "Enhancing...",
  wageRecommended: "Recommended: ₹{price}",
  wageEstimateFail: "Could not estimate wage.",

  // Voice & Errors
  voiceNotSupported: "Voice input is not supported in this browser.",
  micBlocked: "Microphone access blocked.",
  voiceStartFailed: "Failed to start voice input.",
  paymentSuccessJobFail: "Payment successful but failed to create job. Please contact support.",
  cantEditInProgress: "Cannot edit a job that is in progress.",
  cantEditCompleted: "Cannot edit a completed or cancelled job.",
  cancelJobRefundPrompt: "Cancel this job?",
  cancelJob: "Cancel Job",
  deleteJobPrompt: "Are you sure you want to delete this job?",
  withdrawBidPrompt: "Are you sure you want to withdraw your bid?",
  bidWithdrawn: "Bid withdrawn successfully.",
  declineCounterPrompt: "Decline this counter offer? Your bid will be removed.",
  counterDeclined: "Counter declined. Your bid has been withdrawn.",
  counterAcceptedPay: "Counter accepted! Pay to unlock chat.",
  chatUnlocked: "Chat unlocked! ₹{fee} deducted.",
  chatUnlockFail: "Payment recorded but chat unlock failed.",
  chatOnlyAfterAccept: "Chat is only available after job is accepted.",
  notParticipant: "You are not a participant in this job.",

  // App State
};

const HI_TRANSLATIONS = {
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
  accept: "स्वीकार करें",
  counter: "मोलभाव करें",
  hired: "काम मिला",
  declined: "मना किया",
  closed: "बंद",
  pending: "लंबित",
  chat: "चैट करें",
  translate: "अनुवाद करें",
  translating: "अनुवाद हो रहा है...",
  showOriginal: "मूल देखें",
  translateError: "अनुवाद विफल रहा",
  jobDescription: "काम का विवरण",
  startDate: "तारीख",
  postedDate: "पोस्ट किया",
  appliedOn: "आवेदन किया",
  proposedBudget: "आपका बजट",
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
  waitingForPosterFinalize: "प्रस्ताव स्वीकार किया! मालिक द्वारा अंतिम पुष्टि की प्रतीक्षा है।",
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

  // Home - Mode Switcher Fix removed duplicates
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
  bidMessagePlaceholder: "अपना प्रस्ताव बताएं...",

  // Info Modals
  infoGuide: "प्लेटफ़ॉर्म गाइड",
  gotIt: "समझ गया, धन्यवाद",
  safetyTitle: "सुरक्षा नियम",
  securityAlert: "सुरक्षा अलर्ट",
  securityDesc: "कधी भी OTP या पासवर्ड साझा न करें। CHOWKAR आपसे किसी भी परिस्थिति में ये नहीं मांगेगा।",
  essentialGuidelines: "आवश्यक दिशा-निर्देश",
  ruleInAppPayments: "इन-ऐप भुगतान",
  ruleInAppPaymentsDesc: "सुरक्षित रहने के लिए हमेशा हमारे वॉलेट का उपयोग करें।",
  ruleVerifyProfiles: "प्रोफ़ाइल सत्यापित करें",
  ruleVerifyProfilesDesc: "सुनिश्चित करें कि चेहरा प्रोफ़ाइल फोटो से मेल खाता है। आईडी मांगने में संकोच न करें।",
  ruleStayInChat: "चैट में रहें",
  ruleStayInChatDesc: "WhatsApp या कॉल पर न जाएं। आपकी सुरक्षा के लिए चैट रिकॉर्ड की जाती हैं।",
  ruleReportAbuse: "दुरुपयोग की रिपोर्ट करें",
  ruleReportAbuseDesc: "यदि कोई अग्रिम शुल्क मांगता है या संदिग्ध व्यवहार करता है, तो तुरंत रिपोर्ट करें।",
  verifyLocation: "स्थान सत्यापित करें",
  verifyLocationDesc: "बाहर जाने से पहले मानचित्र और दूरी की जाँच करें।",
  publicPlaces: "सार्वजनिक स्थान",
  publicPlacesDesc: "प्रथम संपर्क के लिए अच्छी रोशनी वाले, व्यस्त क्षेत्रों में मिलें।",
  fixedRates: "निश्चित दरें",
  fixedRatesDesc: "शुरू करने से पहले सुनिश्चित करें कि बजट लॉक है।",
  idValidation: "आईडी सत्यापन",
  idValidationDesc: "अंदर आने देने से पहले सरकारी आईडी मांगे।",
  workScope: "कार्य दायरा",
  workScopeDesc: "चैट के माध्यम से सटीक, स्पष्ट निर्देश दें।",
  fairConduct: "उचित व्यवहार",
  fairConductDesc: "सहानुभूति दिखाएं और कड़ी मेहनत के लिए पानी उपलब्ध कराएं।",

  guidelinesTitle: "दिशा-निर्देश",
  guidelinesDesc: "CHOWKAR विश्वास पर बना है। हमारे बाज़ार को सुरक्षित रखने के लिए, कृपया इन मूल सिद्धांतों का पालन करें:",
  respectTitle: "सभी का सम्मान करें",
  respectDesc: "कोई अपमानजनक भाषा, भेदभाव या उत्पीड़न नहीं। सभी के साथ गरिमा से व्यवहार करें।",
  reliableTitle: "भरोसेमंद बनें",
  reliableDesc: "यदि आप स्वीकार करते हैं, तो पहुंचें। यदि आप काम देते हैं, तो स्पष्ट निर्देश दें और समय पर भुगतान करें।",
  honestReviews: "ईमानदार समीक्षाएं",
  honestReviewsDesc: "प्रदर्शन के आधार पर वास्तविक रेटिंग दें। रेटिंग को सौदेबाजी के उपकरण के रूप में उपयोग न करें।",
  safetyFirst: "सुरक्षा सर्वोपरि",
  safetyFirstDesc: "अवैध गतिविधियों के लिए उकसाने पर खाते पर स्थायी प्रतिबंध लगा दिया जाएगा।",

  termsTitle: "नियम एवं शर्तें",
  lastUpdated: "आखिरी अपडेट",
  termsIntro: "CHOWKAR का उपयोग करके, आप इन सरल शर्तों से सहमत होते हैं:",
  termRole: "प्लेटफ़ॉर्म की भूमिका",
  termRoleDesc: "हम उपयोगकर्ताओं को जोड़ने वाले एक मध्यस्थ हैं। हम कामगारों को नियुक्त नहीं करते हैं।",
  termPayments: "भुगतान",
  termPaymentsDesc: "सुरक्षा के लिए हमारे वॉलेट का उपयोग करें। हम केवल नकद विवादों के लिए उत्तरदायी नहीं हैं।",
  termPrivacy: "डेटा गोपनीयता",
  termPrivacyDesc: "हम आसपास के काम खोजने के लिए ही स्थान का उपयोग करते हैं। हम आपका डेटा कभी नहीं बेचते।",
  termTermination: "खाता बंद करना",
  termTerminationDesc: "दिशानिर्देशों का उल्लंघन करने पर खाते पर तुरंत प्रतिबंध लगा दिया जाएगा।",
  termsSummary: "इसमें एक सारांश है। पूर्ण कानूनी पाठ के लिए, कृपया legal@chowkar.in पर संपर्क करें।",

  // Reviews
  rateExperience: "अपना अनुभव रेट करें",
  howWasWork: "इनके साथ काम कैसा रहा",
  writeReviewPlaceholder: "काम के बारे में कुछ शब्द लिखें...",
  submitReview: "रिव्यु जमा करें",
  skip: "छोड़ें",
  reviewSubmitted: "रिव्यु जमा हो गया!",
  compliments: "क्या अच्छा रहा?",

  // Premium
  upgradePremium: "प्रीमियम में अपग्रेड करें",
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
  bestValue: "सबसे अच्छा",

  // New Wallet/Bid Translatons
  commissionCredits: "कमीशन क्रेडिट",
  addCredits: "क्रेडिट जोड़ें",
  withdraw: "निकालें",
  yourOfferLabel: "आपका प्रस्ताव",
  noBidsFound: "कोई बोली नहीं मिली।",
  noBidsDesc: "जब आप बोली लगाना शुरू करेंगे तो आपके आवेदन यहाँ दिखाई देंगे।",
  acceptingBidFeeWarn: "इस बोली को स्वीकार करने पर आपके वॉलेट से ₹{fee} प्लेटफॉर्म शुल्क काट लिया जाएगा। जारी रखें?",

  // Payment Modal
  secureCheckout: "सुरक्षित चेकआउट",
  publishJob: "जॉब पोस्ट करें",
  unlockChat: "चैट अनलॉक करें",
  addFunds: "पैसे जोड़ें",
  paymentSuccessful: "भुगतान सफल!",
  paymentSecureDesc: "आपका लेनदेन सुरक्षित रूप से पूरा हो गया था।",
  paymentFailed: "भुगतान विफल",
  tryAgain: "पुनः प्रयास करें",
  totalPayable: "कुल देय राशि",
  encryptedGateway: "एन्क्रिप्टेड गेटवे",
  securedBy: "Razorpay और SSL प्रोटोकॉल द्वारा सुरक्षित",
  processingTransaction: "लेनदेन संसाधित हो रहा है...",
  payNow: "अभी ₹{amount} का भुगतान करें",

  // Landing Page
  heroTitle: "काम खोजें। स्थानीय लोगों को रखें। शून्य कमीशन।",
  heroSubtitle: "अपने गांव या शहर में भरोसेमंद कामगारों और नियोक्ताओं से सीधे जुड़ें। कोई बिचौलिया नहीं, कोई छिपी हुई फीस नहीं।",
  heroBtnWorker: "काम खोजें",
  heroBtnPoster: "मुफ़्त में शुरू करें",
  popularServices: "लोकप्रिय सेवाएं",
  popularServicesDesc: "किसी भी कार्य के लिए मदद पाएं, कभी भी।",
  successStories: "सफलता की कहानियां",
  successStoriesDesc: "असली लोग, असली कमाई।",
  howItWorks: "यह कैसे काम करता है",
  watchVideo: "वीडियो गाइड देखें",
  faqTitle: "अक्सर पूछे जाने वाले प्रश्न",
  downloadApp: "एंड्रॉइड ऐप डाउनलोड करें (APK)",
  forEmployers: "नियोक्ताओं के लिए",
  forWorkers: "कामगारों के लिए",
  employerDesc: "ड्राइवर, खेत मजदूर, नौकरानी और निर्माण श्रमिकों को तुरंत किराए पर लें।",
  workerDesc: "अपने पास रोज़गार खोजें। नियोक्ता द्वारा सीधे भुगतान प्राप्त करें। कोई कमीशन नहीं।",
  postJobNow: "अभी जॉब पोस्ट करें",
  createProfile: "प्रोफाइल बनाएं",

  // Home - Mode Switcher
  findWork: "काम ढूंढे",
  hireMyJobs: "हायर / मेरे जॉब्स",
  myJobDashboard: "मेरा जॉब डैशबोर्ड",
  all: "सभी",
  open: "ओपन",
  active: "सक्रिय",
  done: "पूर्ण",
  loadMore: "और जॉब देखें",
  loading: "लोड हो रहा है...",

  // Validation
  alertInvalidAmount: "कृपया ₹0 से अधिक वैध राशि दर्ज करें",

  // Lists
  bidsReceived: "प्राप्त बोलियां",
  viewAll: "सभी देखें",
  moreBids: "और बोलियां",

  // App Errors & Success
  chatReceiverError: "त्रुटि: संदेश किसको भेजना है यह तय नहीं कर पा रहे।",
  jobCompletionError: "जॉब पूरा करने में विफल",
  genericError: "विफल: ",
  withdrawBidError: "बोली वापस लेने में त्रुटि",
  jobCancelledRefunded: "जॉब रद्द और पैसे वापस कर दिए गए।",
  cancelError: "रद्द करने में विफल",
  cancellationError: "रद्द करते समय त्रुटि",
  paymentSuccessChat: "भुगतान सफल! चैट अनलॉक।",

  // Common Actions
  cancel: "रद्द करें",
  delete: "हटाएं",
  stop: "रोकें",
  voice: "आवाज़ (Voice)",
  uploading: "अपलोड हो रहा है...",

  // Notifications Panel
  markRead: "पढ़ा हुआ",
  clearAll: "सभी हटाएं",
  clearAllPrompt: "सभी सूचनाएं हटाएं?",
  noNotifications: "अभी तक कोई सूचना नहीं",

  // Job Posting Form
  updateJob: "जॉब अपडेट करें",
  postJobWithFee: "जॉब पोस्ट करें (₹{fee})",
  walletUsageDisclaimer: "वॉलेट से ₹{fee} का उपयोग होगा (शेष: ₹{balance})",
  uploadingImage: "फोटो अपलोड हो रही है...",
  jobPostedDeduction: "जॉब पोस्ट हुई! वॉलेट से ₹{fee} काटे गए।",
  photoAnalyzed: "फोटो के आधार पर विवरण अपडेट किया गया।",
  analyzeAi: "AI विश्लेषण",
  addPhoto: "फोटो जोड़ें",
  enhancing: "सुधार रहा है...",
  wageRecommended: "अनुशंसित: ₹{price}",
  wageEstimateFail: "अनुमान नहीं लगा सके।",

  // Voice & Errors
  voiceNotSupported: "आपका ब्राउज़र वॉयस इनपुट सपोर्ट नहीं करता।",
  micBlocked: "माइक्रोफ़ोन एक्सेस ब्लॉक है।",
  voiceStartFailed: "वॉयस इनपुट शुरू करने में विफल।",
  paymentSuccessJobFail: "भुगतान सफल लेकिन जॉब बनाने में विफल। सहायता से संपर्क करें।",
  cantEditInProgress: "प्रगति पर चल रहे काम को संपादित नहीं कर सकते।",
  cantEditCompleted: "पूरे हो चुके या रद्द किए गए काम को संपादित नहीं कर सकते।",
  cancelJobRefundPrompt: "क्या आप यह जॉब रद्द करना चाहते हैं?",
  cancelJob: "रॉब रद्द करें",
  deleteJobPrompt: "क्या आप इस जॉब को हटाना चाहते हैं?",
  withdrawBidPrompt: "क्या आप अपनी बोली वापस लेना चाहते हैं?",
  bidWithdrawn: "बोली सफलतापूर्वक वापस ली गई।",
  declineCounterPrompt: "क्या आप इस प्रस्ताव को अस्वीकार करना चाहते हैं?",
  counterDeclined: "प्रस्ताव अस्वीकार। आपकी बोली वापस ले ली गई।",
  counterAcceptedPay: "काउंटर स्वीकार! चैट अनलॉक करने के लिए भुगतान करें।",
  chatUnlocked: "चैट अनलॉक! वॉलेट से ₹{fee} काटे गए।",
  chatUnlockFail: "भुगतान दर्ज किया गया लेकिन अनलॉक विफल रहा।",
  chatOnlyAfterAccept: "चैट केवल जॉब स्वीकार होने के बाद उपलब्ध है",
  notParticipant: "आप इस जॉब में भागीदार नहीं हैं",

  // App State
  online: "ऑनलाइन",
  offline: "ऑफ़लाइन",
};

export const TRANSLATIONS = {
  en: EN_TRANSLATIONS,
  hi: HI_TRANSLATIONS,
  pa: {
    ...EN_TRANSLATIONS,
    // Basic keys for PA to avoid crashes, reusing HI for others temporarily
    translate: "ਅਨੁਵਾਦ ਕਰੋ",
    translating: "ਅਨੁਵਾਦ ਹੋ ਰਿਹਾ ਹੈ...",
    showOriginal: "ਅਸਲੀ ਦੇਖੋ",
    translateError: "ਅਨੁਵਾਦ ਅਸਫਲ ਰਿਹਾ",
    jobDescription: "ਕੰਮ ਦਾ ਵੇਰਵਾ",
    budget: "ਬਜਟ",
    duration: "ਸਮਾਂ",
    distance: "ਦੂਰੀ",
    postedBy: "ਪੋਸਟ ਕੀਤਾ",
    bidNow: "ਬੋਲੀ ਲਗਾਓ",
    viewBids: "ਬੋਲੀਆਂ ਦੇਖੋ",
    accept: "ਮਨਜ਼ੂਰ ਕਰੋ",
    counter: "ਸੌਦੇਬਾਜ਼ੀ ਕਰੋ",
    chat: "ਚੈਟ ਕਰੋ",
    pending: "ਬਾਕੀ",
    accepted: "ਸਵੀਕਾਰ ਕੀਤਾ",
    hired: "ਕੰਮ ਮਿਲ ਗਿਆ",
    declined: "ਮਨ੍ਹਾ ਕੀਤਾ",
    closed: "ਬੰਦ",
  }
};

export const POSTER_FEE = 0; // Free for now
export const WORKER_COMMISSION_RATE = 0; // 0% commission
export const FREE_AI_USAGE_LIMIT = 2; // Number of free AI uses allowed
export const PREMIUM_PRICE = 199; // ₹199 for life-time or annual (simplified)

export const DRAFT_STORAGE_KEY = 'chowkar_job_draft';

