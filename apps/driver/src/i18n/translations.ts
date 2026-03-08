export type DriverLanguage = 'en' | 'hi' | 'kn';

export type TranslationKey =
  | 'lang.en'
  | 'lang.hi'
  | 'lang.kn'
  | 'auth.title'
  | 'auth.subtitle'
  | 'auth.sendOtp'
  | 'auth.phone'
  | 'auth.name'
  | 'auth.verifyTitle'
  | 'auth.verifySubtitle'
  | 'auth.resendOtp'
  | 'home.title'
  | 'home.assistant.title'
  | 'home.assistant.offer'
  | 'home.assistant.current'
  | 'home.assistant.idle'
  | 'home.availability.title'
  | 'home.availability.online'
  | 'home.availability.offline'
  | 'home.availability.busy'
  | 'home.online'
  | 'home.offline'
  | 'home.offer.title'
  | 'home.offer.none'
  | 'home.offer.accept'
  | 'home.offer.skip'
  | 'home.offer.navigate'
  | 'home.trip.title'
  | 'home.trip.none'
  | 'home.trip.navigatePickup'
  | 'home.trip.navigateDrop'
  | 'home.queue.title'
  | 'home.queue.none'
  | 'home.support'
  | 'home.supportSub'
  | 'profile.title'
  | 'profile.preferences'
  | 'profile.language'
  | 'profile.simpleMode'
  | 'profile.voiceGuide'
  | 'profile.hints'
  | 'profile.logout'
  | 'onboarding.help.title'
  | 'onboarding.help.profile'
  | 'onboarding.help.vehicle'
  | 'onboarding.help.payout'
  | 'onboarding.help.docs'
  | 'onboarding.help.status';

const translations: Record<DriverLanguage, Record<TranslationKey, string>> = {
  en: {
    'lang.en': 'English',
    'lang.hi': 'Hindi',
    'lang.kn': 'Kannada',
    'auth.title': 'Drive with Qargo',
    'auth.subtitle': 'Very easy app. Just follow steps and start earning.',
    'auth.sendOtp': 'Send OTP',
    'auth.phone': 'Phone number',
    'auth.name': 'Full name',
    'auth.verifyTitle': 'Verify OTP',
    'auth.verifySubtitle': 'Code sent to {phone}',
    'auth.resendOtp': 'Resend OTP',
    'home.title': 'Driver Home',
    'home.assistant.title': 'Driver Assistant',
    'home.assistant.offer': 'New request received. Tap Accept Job to continue.',
    'home.assistant.current': 'Trip is active. Follow stage button and keep location on.',
    'home.assistant.idle': 'Go online and keep app open. We will alert you for jobs.',
    'home.availability.title': 'Availability',
    'home.availability.online': 'You are online',
    'home.availability.offline': 'You are offline',
    'home.availability.busy': 'Trip in progress',
    'home.online': 'Go Online',
    'home.offline': 'Go Offline',
    'home.offer.title': 'Incoming Job',
    'home.offer.none': 'No incoming jobs right now. Keep app open and stay online.',
    'home.offer.accept': 'Accept Job',
    'home.offer.skip': 'Skip',
    'home.offer.navigate': 'Open Pickup in Google Maps',
    'home.trip.title': 'Current Trip',
    'home.trip.none': 'No active trip. Stay online to receive offers.',
    'home.trip.navigatePickup': 'Navigate to Pickup',
    'home.trip.navigateDrop': 'Navigate to Drop',
    'home.queue.title': 'Queued Job',
    'home.queue.none': 'No queued order right now.',
    'home.support': 'Call Support',
    'home.supportSub': 'Need help? Tap once and call support team.',
    'profile.title': 'Driver Profile',
    'profile.preferences': 'App Preferences',
    'profile.language': 'Language',
    'profile.simpleMode': 'Simple Driver Mode',
    'profile.voiceGuide': 'Voice Guidance',
    'profile.hints': 'Guided Hints',
    'profile.logout': 'Logout',
    'onboarding.help.title': 'Quick Help',
    'onboarding.help.profile': 'Step 1 of 5: Fill your basic details.',
    'onboarding.help.vehicle': 'Step 2 of 5: Add vehicle and license details.',
    'onboarding.help.payout': 'Step 3 of 5: Add bank + UPI and upload QR.',
    'onboarding.help.docs': 'Step 4 of 5: Upload documents and submit.',
    'onboarding.help.status': 'Step 5 of 5: Wait for KYC approval.'
  },
  hi: {
    'lang.en': 'English',
    'lang.hi': 'हिंदी',
    'lang.kn': 'ಕನ್ನಡ',
    'auth.title': 'Qargo के साथ ड्राइव करें',
    'auth.subtitle': 'ऐप बहुत आसान है। बस स्टेप फॉलो करें और कमाई शुरू करें।',
    'auth.sendOtp': 'OTP भेजें',
    'auth.phone': 'मोबाइल नंबर',
    'auth.name': 'पूरा नाम',
    'auth.verifyTitle': 'OTP सत्यापित करें',
    'auth.verifySubtitle': '{phone} पर कोड भेजा गया',
    'auth.resendOtp': 'OTP दोबारा भेजें',
    'home.title': 'ड्राइवर होम',
    'home.assistant.title': 'ड्राइवर सहायक',
    'home.assistant.offer': 'नई रिक्वेस्ट आई है। आगे बढ़ने के लिए Accept Job दबाएं।',
    'home.assistant.current': 'ट्रिप चल रही है। स्टेज बटन दबाते रहें और लोकेशन चालू रखें।',
    'home.assistant.idle': 'ऑनलाइन जाएँ और ऐप खुला रखें। जॉब आने पर अलर्ट मिलेगा।',
    'home.availability.title': 'उपलब्धता',
    'home.availability.online': 'आप ऑनलाइन हैं',
    'home.availability.offline': 'आप ऑफलाइन हैं',
    'home.availability.busy': 'ट्रिप जारी है',
    'home.online': 'ऑनलाइन जाएँ',
    'home.offline': 'ऑफलाइन जाएँ',
    'home.offer.title': 'नई जॉब',
    'home.offer.none': 'अभी कोई जॉब नहीं है। ऐप खुला रखें और ऑनलाइन रहें।',
    'home.offer.accept': 'जॉब स्वीकार करें',
    'home.offer.skip': 'छोड़ें',
    'home.offer.navigate': 'Google Maps में पिकअप खोलें',
    'home.trip.title': 'मौजूदा ट्रिप',
    'home.trip.none': 'कोई सक्रिय ट्रिप नहीं। ऑफर पाने के लिए ऑनलाइन रहें।',
    'home.trip.navigatePickup': 'पिकअप तक जाएँ',
    'home.trip.navigateDrop': 'ड्रॉप तक जाएँ',
    'home.queue.title': 'अगली जॉब',
    'home.queue.none': 'अभी कोई अगली जॉब नहीं है।',
    'home.support': 'सपोर्ट कॉल करें',
    'home.supportSub': 'मदद चाहिए? एक टैप में सपोर्ट टीम से बात करें।',
    'profile.title': 'ड्राइवर प्रोफाइल',
    'profile.preferences': 'ऐप सेटिंग्स',
    'profile.language': 'भाषा',
    'profile.simpleMode': 'सरल ड्राइवर मोड',
    'profile.voiceGuide': 'वॉइस गाइड',
    'profile.hints': 'गाइडेड हिंट्स',
    'profile.logout': 'लॉगआउट',
    'onboarding.help.title': 'तुरंत मदद',
    'onboarding.help.profile': 'स्टेप 1/5: अपनी जानकारी भरें।',
    'onboarding.help.vehicle': 'स्टेप 2/5: वाहन और लाइसेंस जोड़ें।',
    'onboarding.help.payout': 'स्टेप 3/5: बैंक + UPI और QR जोड़ें।',
    'onboarding.help.docs': 'स्टेप 4/5: दस्तावेज़ अपलोड करके सबमिट करें।',
    'onboarding.help.status': 'स्टेप 5/5: KYC अनुमोदन का इंतज़ार करें।'
  },
  kn: {
    'lang.en': 'English',
    'lang.hi': 'हिंदी',
    'lang.kn': 'ಕನ್ನಡ',
    'auth.title': 'Qargo ಜೊತೆ ಡ್ರೈವ್ ಮಾಡಿ',
    'auth.subtitle': 'ಆಪ್ ತುಂಬಾ ಸುಲಭ. ಹಂತಗಳನ್ನು ಅನುಸರಿಸಿ, ಆದಾಯ ಆರಂಭಿಸಿ.',
    'auth.sendOtp': 'OTP ಕಳುಹಿಸಿ',
    'auth.phone': 'ಮೊಬೈಲ್ ಸಂಖ್ಯೆ',
    'auth.name': 'ಪೂರ್ಣ ಹೆಸರು',
    'auth.verifyTitle': 'OTP ಪರಿಶೀಲಿಸಿ',
    'auth.verifySubtitle': '{phone} ಗೆ ಕೋಡ್ ಕಳುಹಿಸಲಾಗಿದೆ',
    'auth.resendOtp': 'OTP ಮರುಕಳುಹಿಸಿ',
    'home.title': 'ಡ್ರೈವರ್ ಹೋಮ್',
    'home.assistant.title': 'ಡ್ರೈವರ್ ಸಹಾಯಕ',
    'home.assistant.offer': 'ಹೊಸ ರಿಕ್ವೆಸ್ಟ್ ಬಂದಿದೆ. ಮುಂದುವರಿಸಲು Accept Job ಒತ್ತಿ.',
    'home.assistant.current': 'ಟ್ರಿಪ್ ನಡೆಯುತ್ತಿದೆ. ಹಂತ ಬಟನ್ ಒತ್ತುತ್ತಾ ಮುಂದೆ ಸಾಗಿರಿ.',
    'home.assistant.idle': 'ಆನ್ಲೈನ್ ಇರಿ ಮತ್ತು ಆಪ್ ತೆರೆಯೇ ಇರಿ. ಜಾಬ್ ಬಂದಾಗ ಅಲರ್ಟ್ ಬರುತ್ತದೆ.',
    'home.availability.title': 'ಲಭ್ಯತೆ',
    'home.availability.online': 'ನೀವು ಆನ್ಲೈನ್‌ನಲ್ಲಿ ಇದ್ದೀರಿ',
    'home.availability.offline': 'ನೀವು ಆಫ್‌ಲೈನ್‌ನಲ್ಲಿ ಇದ್ದೀರಿ',
    'home.availability.busy': 'ಟ್ರಿಪ್ ಪ್ರಗತಿಯಲ್ಲಿ ಇದೆ',
    'home.online': 'ಆನ್ಲೈನ್',
    'home.offline': 'ಆಫ್‌ಲೈನ್',
    'home.offer.title': 'ಹೊಸ ಜಾಬ್',
    'home.offer.none': 'ಈಗ ಜಾಬ್ ಇಲ್ಲ. ಆಪ್ ತೆರೆಯೇ ಇರಿ ಮತ್ತು ಆನ್ಲೈನ್ ಇರಿ.',
    'home.offer.accept': 'ಜಾಬ್ ಸ್ವೀಕರಿಸಿ',
    'home.offer.skip': 'ಬಿಡಿ',
    'home.offer.navigate': 'Google Maps ನಲ್ಲಿ ಪಿಕಪ್ ತೆರೆಯಿರಿ',
    'home.trip.title': 'ಪ್ರಸ್ತುತ ಟ್ರಿಪ್',
    'home.trip.none': 'ಸಕ್ರಿಯ ಟ್ರಿಪ್ ಇಲ್ಲ. ಆಫರ್‌ಗಳಿಗೆ ಆನ್ಲೈನ್ ಇರಿ.',
    'home.trip.navigatePickup': 'ಪಿಕಪ್‌ಗೆ ನ್ಯಾವಿಗೇಟ್',
    'home.trip.navigateDrop': 'ಡ್ರಾಪ್‌ಗೆ ನ್ಯಾವಿಗೇಟ್',
    'home.queue.title': 'ಮುಂದಿನ ಜಾಬ್',
    'home.queue.none': 'ಈಗ ಯಾವುದೇ ಕ್ಯೂಡ್ ಜಾಬ್ ಇಲ್ಲ.',
    'home.support': 'ಸಪೋರ್ಟ್‌ಗೆ ಕರೆ ಮಾಡಿ',
    'home.supportSub': 'ಸಹಾಯ ಬೇಕಾ? ಒಂದು ಟ್ಯಾಪ್‌ನಲ್ಲಿ ಸಪೋರ್ಟ್‌ಗೆ ಕರೆ ಮಾಡಿ.',
    'profile.title': 'ಡ್ರೈವರ್ ಪ್ರೊಫೈಲ್',
    'profile.preferences': 'ಆಪ್ ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    'profile.language': 'ಭಾಷೆ',
    'profile.simpleMode': 'ಸರಳ ಡ್ರೈವರ್ ಮೋಡ್',
    'profile.voiceGuide': 'ವಾಯ್ಸ್ ಮಾರ್ಗದರ್ಶನ',
    'profile.hints': 'ಗೈಡೆಡ್ ಸೂಚನೆಗಳು',
    'profile.logout': 'ಲಾಗ್‌ಔಟ್',
    'onboarding.help.title': 'ತ್ವರಿತ ಸಹಾಯ',
    'onboarding.help.profile': 'ಹಂತ 1/5: ಮೂಲ ವಿವರಗಳನ್ನು ತುಂಬಿ.',
    'onboarding.help.vehicle': 'ಹಂತ 2/5: ವಾಹನ ಮತ್ತು ಲೈಸೆನ್ಸ್ ಸೇರಿಸಿ.',
    'onboarding.help.payout': 'ಹಂತ 3/5: ಬ್ಯಾಂಕ್ + UPI ಮತ್ತು QR ಸೇರಿಸಿ.',
    'onboarding.help.docs': 'ಹಂತ 4/5: ದಾಖಲೆಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ ಸಲ್ಲಿಸಿ.',
    'onboarding.help.status': 'ಹಂತ 5/5: KYC ಅನುಮೋದನೆಗಾಗಿ ಕಾಯಿರಿ.'
  }
};

export function translate(
  language: DriverLanguage,
  key: TranslationKey,
  params?: Record<string, string | number>
) {
  const template =
    translations[language]?.[key] ??
    translations.en[key] ??
    key;

  if (!params) {
    return template;
  }

  return Object.entries(params).reduce((value, [paramKey, paramValue]) => {
    return value.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
  }, template);
}
