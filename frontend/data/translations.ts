export type LanguageCode = 'en' | 'rw';

export interface AppCopy {
  nav: {
    home: string;
    about: string;
    contact: string;
    campuses: string;
    announcements: string;
    login: string;
    console: string;
    joinPlatform: string;
    openConsole: string;
    signOut: string;
  };
  hero: {
    kicker: string;
    welcomePrefix: string;
    welcomeHighlight: string;
    subtitle: string;
    clockLabel: string;
    nextBellLabel: string;
    summaryKicker: string;
    summaryTitle: string;
    summaryPoints: string[];
    enterPortal: string;
    quickGuide: string;
    ourServices: string;
  };
  sections: {
    campusesKicker: string;
    campusesTitle: string;
    campusesSubtitle: string;
    previewBell: string;
    viewPhoto: string;
    audioKicker: string;
    audioTitle: string;
    audioSubtitle: string;
    ringSample: string;
    stopSound: string;
    announcementsKicker: string;
    announcementsTitle: string;
    announcementsSubtitle: string;
    guideKicker: string;
    guideTitle: string;
    guideSubtitle: string;
    aboutPillars: { number: string; title: string; detail: string }[];
    contactKicker: string;
    contactTitle: string;
    contactSubtitle: string;
    contactFormTitle: string;
    contactFirstName: string;
    contactLastName: string;
    contactEmailLabel: string;
    contactSubjectLabel: string;
    contactSubjectPlaceholder: string;
    contactSubjects: string[];
    contactMessageLabel: string;
    contactMessagePlaceholder: string;
    contactSend: string;
    contactSentTitle: string;
    contactSentDetail: string;
    contactDetailsTitle: string;
    contactConnectTitle: string;
  };
  login: {
    backHome: string;
    portalTitle: string;
    portalSubtitle: string;
    usernameLabel: string;
    usernamePlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    submitButton: string;
    signingIn: string;
    imageKicker: string;
    imageTitle: string;
    imageSubtitle: string;
    note1: string;
    note2: string;
  };
}

export const TRANSLATIONS: Record<LanguageCode, AppCopy> = {
  en: {
    nav: {
      home: 'Home',
      about: 'About Us',
      contact: 'Contact',
      campuses: 'Campuses',
      announcements: 'Announcements',
      login: 'Login',
      console: 'Dashboard',
      joinPlatform: 'Join Platform',
      openConsole: 'Open Dashboard',
      signOut: 'Sign Out',
    },
    hero: {
      kicker: 'BellCraft School System',
      welcomePrefix: 'Welcome to',
      welcomeHighlight: 'Automatic School Bell System',
      subtitle:
        'Manage your school bells from anywhere with automated timetables, multi-zone speakers, and instant campus alerts.',
      clockLabel: 'Master Campus Time',
      nextBellLabel: 'Next Scheduled Bell',
      summaryKicker: 'At a Glance',
      summaryTitle: 'System summary',
      summaryPoints: [
        'Automated bell ringing: exact 24-hour schedules for morning assembly, periods, and breaks.',
        'Smart zone routing across main bell towers, science wings, libraries, and sports plazas.',
        'Instant schedule profile switching for Regular Term, Exam Week, and Friday Half-Day.',
        'Live audio tone audition, manual emergency alerts, and complete ring audit history.',
      ],
      enterPortal: 'Enter Portal',
      quickGuide: 'Quick Guide',
      ourServices: 'Our Services',
    },
    sections: {
      campusesKicker: 'School Campuses & Services',
      campusesTitle: 'Beautiful School Environments Connected by Precision Sound',
      campusesSubtitle:
        'Explore how our automatic bell system serves classrooms, science blocks, libraries, and open campus grounds.',
      previewBell: 'Preview Zone Bell',
      viewPhoto: 'View Campus Photo',
      audioKicker: 'Live Audio Studio',
      audioTitle: 'Audition School Bell Tones',
      audioSubtitle:
        'Click any acoustic chime below to test the exact sound played across your campus zones.',
      ringSample: 'Ring Selected Tone',
      stopSound: 'Stop Sound',
      announcementsKicker: 'Public Notices & Promotions',
      announcementsTitle: 'Public Announcements & Offers',
      announcementsSubtitle:
        'Installation promotions, product news, and public updates published by BellCraft Admin for everyone and new visitors. Registered school notices appear inside the logged-in Dashboard.',
      guideKicker: 'About Us',
      guideTitle: 'About BellCraft Automatic School Bell System',
      guideSubtitle:
        'Built from the ground up to replace unreliable manual bell ringing with accurate, multi-zone campus timekeeping.',
      aboutPillars: [
        {
          number: '01',
          title: 'Introduction of This System',
          detail:
            'BellCraft is a web-based Automatic School Bell System designed for primary, secondary, and higher institutions. It connects a real-time master clock with customizable daily timetables, acoustic chime tones, and campus speaker zones so every class transition happens smoothly.',
        },
        {
          number: '02',
          title: 'Our Objective',
          detail:
            'Our objective is to eliminate timing delays across school campuses, simplify timetable switches between regular days, exam weeks, and half-days, and give school administrators one secure portal to monitor and control every bell automatically.',
        },
        {
          number: '03',
          title: 'The Problem We Solve',
          detail:
            'Many schools still rely on manual bell ringing, which leads to late or missed bells, human distractions, inconsistent timing across distant buildings, noise disruptions during quiet exams, and zero record of when bells actually rang.',
        },
        {
          number: '04',
          title: 'Overview of the Whole System',
          detail:
            'The platform combines four integrated parts: (1) Staff Authentication via Email & Password, (2) Cloud Timetable & Profile Manager in Firebase Realtime Database, (3) Multi-Zone Acoustic Bell Engine powered by Web Audio synthesis, and (4) Manual Override & Real-Time Ring History Logs.',
        },
      ],
      contactKicker: 'Get In Touch',
      contactTitle: 'Get In Touch',
      contactSubtitle:
        'Have questions about our Automatic School Bell System? Our support team is ready to help with technical inquiries, school installations, or timetable setup.',
      contactFormTitle: 'Send Us a Message',
      contactFirstName: 'First Name',
      contactLastName: 'Last Name',
      contactEmailLabel: 'Email Address',
      contactSubjectLabel: 'Subject',
      contactSubjectPlaceholder: 'Select a subject',
      contactSubjects: [
        'School Campus Installation',
        'Timetable & Zone Setup',
        'Technical Support',
        'Partnership & Demo Request',
      ],
      contactMessageLabel: 'Your Message',
      contactMessagePlaceholder: 'How can we help your school?',
      contactSend: 'Send Message',
      contactSentTitle: 'Message Sent Successfully',
      contactSentDetail:
        'Thank you for contacting BellCraft. Our team will respond to your email shortly.',
      contactDetailsTitle: 'Contact Details',
      contactConnectTitle: 'Connect With Us',
    },
    login: {
      backHome: 'Back to Home',
      portalTitle: 'Portal Sign In',
      portalSubtitle:
        'Sign in with the email and password issued to your school by BellCraft Company during installation.',
      usernameLabel: 'Username',
      usernamePlaceholder: 'Enter your username',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter your password',
      submitButton: 'Sign In',
      signingIn: 'Signing in...',
      imageKicker: 'Multi-School Bell Control',
      imageTitle: 'Centralized Bell Control for Every Campus',
      imageSubtitle:
        'Manage daily class periods, switch to examination schedules, and administer isolated settings for each school.',
      note1:
        'Accounts are provisioned exclusively by BellCraft Company. Schools cannot create accounts on their own.',
      note2:
        'Company administrators assign up to two staff accounts per school, each isolated in Firebase Realtime Database.',
    },
  },
  rw: {
    nav: {
      home: 'Ahabanza',
      about: 'Ibyerekeye',
      contact: 'Twandikire',
      campuses: 'Ibigo by’Amashuri',
      announcements: 'Amatangazo',
      login: 'Kwinjira',
      console: 'Dashboard',
      joinPlatform: 'Injira muri Sisitemu',
      openConsole: 'Fungura Dashboard',
      signOut: 'Sohoka',
    },
    hero: {
      kicker: 'BellCraft School System',
      welcomePrefix: 'Ikaze muri',
      welcomeHighlight: 'Automatic School Bell System',
      subtitle:
        'Genzura inzogera z’ishuri ryawe aho uri hose ukoresheje ingengabihe yikora, ibyuma by’amajwi mu bice bitandukanye, n’uburyo bwo gutanga amatangazo.',
      clockLabel: 'Isaha y’Ishuri',
      nextBellLabel: 'Inzogera Ikurikiyeho',
      summaryKicker: 'Mu Ncamake',
      summaryTitle: 'Iby’ingenzi muri sisitemu',
      summaryPoints: [
        'Inzogera yikora ku masaha nyayo ya mu gitondo, amasomo, ikiruhuko, no gutaha.',
        'Gukwirakwiza amajwi mu bice by’ishuri: ibyumba by’amasomo, isomero, n’ikibuga.',
        'Guhindura ingengabihe mu kanya gato: Igihe Gisanzwe, Ibizamini, n’Iminsi y’Igice.',
        'Kumva amajwi y’inzogera imbonankubone, gutanga impuruza, no kubika amateka y’igihe yavugiye.',
      ],
      enterPortal: 'Injira muri Sisitemu',
      quickGuide: 'Uko Ikora',
      ourServices: 'Serivisi Zacu',
    },
    sections: {
      campusesKicker: 'Ibigo by’Amashuri & Serivisi',
      campusesTitle: 'Amafoto Meza y’Ibigo by’Amashuri Bikoresha Inzogera Zikora',
      campusesSubtitle:
        'Reba uburyo sisitemu yacu ikora mu nyubako z’amasomo, amasomero, n’imbuga z’ibigo by’amashuri.',
      previewBell: 'Umva Inzogera y’iki Gice',
      viewPhoto: 'Reba Ifoto Neza',
      audioKicker: 'Icyumba cy’Amajwi',
      audioTitle: 'Gerageza Amajwi y’Inzogera',
      audioSubtitle:
        'Kanda ku ijwi iryo ari ryo ryose hasi wumve uko inzogera ivuga mu bigo by’amashuri.',
      ringSample: 'Vuza Ijwi Wahisemo',
      stopSound: 'Hagarika Ijwi',
      announcementsKicker: 'Amatangazo Rusange & Poromosiyo',
      announcementsTitle: 'Amatangazo ya BellCraft Kuri Bose',
      announcementsSubtitle:
        'Poromosiyo nshya zo gushyira inzogera mu bigo (installation), amakuru rusange, n’udushya bitangazwa na Admin kugira ngo abantu bose n’abashyitsi bashya babibone. Amatangazo y’ibigo byiyandikishije aboneka nyuma yo kwinjira (Login).',
      guideKicker: 'Ibyerekeye Sisitemu (About Us)',
      guideTitle: 'Ibyerekeye BellCraft Automatic School Bell System',
      guideSubtitle:
        'Yubatswe mu buryo bwihariye kugira ngo isimbuze kuvuza inzogera n’intoki, izane gukora ku gihe nyacyo mu kigo cyose.',
      aboutPillars: [
        {
          number: '01',
          title: 'Intangiriro ya Sisitemu (Introduction)',
          detail:
            'BellCraft ni sisitemu ikorera kuri murandasi y’inzogera z’ishuri zikoresha uburyo bwikora (Automatic School Bell System). Ihuza isaha nyayo y’ishuri n’ingengabihe z’amasomo, amajwi atandukanye y’inzogera, n’ibyuma by’amajwi mu nyubako zose z’ikigo.',
        },
        {
          number: '02',
          title: 'Intego Yacu (Our Objective)',
          detail:
            'Intego yacu ni ugukuraho gukererwa cyangwa kwibagirwa kuvuza inzogera, koroshya guhindura ingengabihe hagati y’iminsi isanzwe n’iy’ibizamini, no guha ubuyobozi bw’ishuri urubuga rumwe rwizewe rwo kugenzura inzogera zose.',
        },
        {
          number: '03',
          title: 'Ikibazo Ikemura (The Problem)',
          detail:
            'Amashuri menshi aracyavuza inzogera n’intoki, ibyo bikunze gutera gukererwa, kwibeshya ku masaha, urusaku rutari ngombwa mu gihe cy’ibizamini, no kutagira amateka agaragaza igihe inzogera yavugiye.',
        },
        {
          number: '04',
          title: 'Incamake ya Sisitemu Yose (System Overview)',
          detail:
            'Sisitemu yose igizwe n’ibice bine byuzuzanya: (1) Kwinjira kw’abakozi ukoresheje Email na Password, (2) Kubika no guhindura ingengabihe muri Firebase Realtime Database, (3) Uburyo bwo kuvuza inzogera mu bice by’ishuri, na (4) Uburyo bwo kuvuza ako kanya no kubika raporo (Ring History).',
        },
      ],
      contactKicker: 'Twandikire',
      contactTitle: 'Twandikire (Get In Touch)',
      contactSubtitle:
        'Ufite ikibazo kuri Automatic School Bell System yacu? Ikipe yacu yiteguye kugufasha mu bya tekiniki, gushyiraho ingengabihe, no gukorana natwe.',
      contactFormTitle: 'Twoherereze Ubutumwa',
      contactFirstName: 'Izina Ryawe',
      contactLastName: 'Izina ry’Umuryango',
      contactEmailLabel: 'Imeyili (Email Address)',
      contactSubjectLabel: 'Impamvu',
      contactSubjectPlaceholder: 'Hitamo impamvu',
      contactSubjects: [
        'Gushyira Sisitemu mu Kigo cy’Ishuri',
        'Gutegura Ingengabihe n’Ibice',
        'Ubufasha bwa Tekiniki',
        'Ubufatanye & Kugerageza Sisitemu',
      ],
      contactMessageLabel: 'Ubutumwa Bwawe',
      contactMessagePlaceholder: 'Twagufasha iki mu ishuri ryawe?',
      contactSend: 'Ohereza Ubutumwa',
      contactSentTitle: 'Ubutumwa Bwoherejwe',
      contactSentDetail:
        'Murakoze kutwandikira. Ikipe ya BellCraft izabasubiza kuri imeyili yanyu vuba.',
      contactDetailsTitle: 'Aho Mwatubonera',
      contactConnectTitle: 'Duhure kuri Murandasi',
    },
    login: {
      backHome: 'Subira Ahabanza',
      portalTitle: 'Kwinjira muri Sisitemu',
      portalSubtitle:
        'Injira ukoresheje imeyili n’ijambo ry’ibanga ikigo cyahawe na BellCraft Company mu gihe cyo gushyira sisitemu mu kigo.',
      usernameLabel: 'Izina (Username)',
      usernamePlaceholder: 'Andika username yawe',
      passwordLabel: 'Ijambo ry’ibanga (Password)',
      passwordPlaceholder: 'Andika password yawe',
      submitButton: 'Injira',
      signingIn: 'Birimo kwinjira...',
      imageKicker: 'Ubuyobozi bw’Ibigo by’Amashuri',
      imageTitle: 'Genzura Inzogera za Buri Kigo mu Mutekano',
      imageSubtitle:
        'Tegura amasaha yo kwiga, hindura ingengabihe y’ibizamini, unagenzure buri kigo ukwacyo.',
      note1:
        'Konti zose zitangwa na BellCraft Company gusa; abakoresha b’ikigo ntibemerewe kwikorera konti.',
      note2:
        'Umuyobozi wa kampani ashyiriraho buri kigo abakozi batarenze babiri babona amakuru y’ikigo cyabo gusa muri Realtime Database.',
    },
  },
};
