import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const en = {
  translation: {
    login: 'Sign In',
    email: 'Email',
    password: 'Password',
    projects: 'Projects',
    tasks: 'Tasks',
    status: 'Status',
    pending: 'Pending',
    inProgress: 'In Progress',
    done: 'Done',
    blocked: 'Blocked',
    uploadPhoto: 'Upload Photo',
    offline: 'Offline — changes will sync when connected',
    signOut: 'Sign Out',
    noProjects: 'No projects assigned.',
    noTasks: 'No tasks for this project.',
  },
};

const ta = {
  translation: {
    login: 'உள்நுழைக',
    email: 'மின்னஞ்சல்',
    password: 'கடவுச்சொல்',
    projects: 'திட்டங்கள்',
    tasks: 'பணிகள்',
    status: 'நிலை',
    pending: 'நிலுவையில்',
    inProgress: 'நடவடிக்கையில்',
    done: 'முடிந்தது',
    blocked: 'தடுக்கப்பட்டது',
    uploadPhoto: 'புகைப்படம் பதிவேற்று',
    offline: 'ஆஃப்லைன் — இணைப்பு கிடைக்கும்போது ஒத்திசைக்கப்படும்',
    signOut: 'வெளியேறு',
    noProjects: 'நியமிக்கப்பட்ட திட்டங்கள் இல்லை.',
    noTasks: 'இந்த திட்டத்திற்கு பணிகள் இல்லை.',
  },
};

i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources: { en, ta },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
