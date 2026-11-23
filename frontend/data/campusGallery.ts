import { CampusShowcasePhoto } from '../types';

export const HERO_CAMPUS_IMAGE = '/frontend/assets/images/hero_school_campus_1794828413203.jpg';
export const LOGIN_CAMPUS_IMAGE = '/frontend/assets/images/login_campus_arch_1794828416051.jpg';
export const LOGIN_STUDENTS_UNIFORM_IMAGE =
  '/frontend/assets/images/school_students_uniform_1795028712975.jpg';

export const CAMPUS_GALLERY: CampusShowcasePhoto[] = [
  {
    id: 'main-courtyard',
    title: 'Central Bell Tower & Quad',
    campusArea: 'Main Academic Grounds',
    zoneTag: 'Zone 01 · Clocktower Array',
    tone: 'westminster-chime',
    description:
      'Synchronized acoustic horn coverage across open stone walkways, main lecture blocks, and the central gathering lawn.',
    imageSrc: HERO_CAMPUS_IMAGE,
    imageAlt: 'Sunlit school campus with central brick bell tower and green courtyard lawns',
  },
  {
    id: 'science-library',
    title: 'Science & Library Pavilion',
    campusArea: 'North Academic Wing',
    zoneTag: 'Zone 02 · Low-Decibel Chime',
    tone: 'gentle-tone',
    description:
      'Calibrated warm harmonic chimes inside quiet study halls, laboratories, and reading terraces without jarring disruption.',
    imageSrc: '/frontend/assets/images/school_science_wing_1794828413992.jpg',
    imageAlt: 'Modern school science and library building with warm timber louvers and garden courtyard',
  },
  {
    id: 'colonnade-quad',
    title: 'West Colonnade & Classrooms',
    campusArea: 'Secondary Teaching Block',
    zoneTag: 'Zone 03 · Corridor Bells',
    tone: 'brass-bell',
    description:
      'Crisp class-transition bell signals timed down to the second for effortless movement between laboratory and seminar rooms.',
    imageSrc: '/frontend/assets/images/school_quad_courtyard_1794828413496.jpg',
    imageAlt: 'Sunlit school campus quadrangle with stone colonnade and shade trees',
  },
  {
    id: 'plaza-athletics',
    title: 'Campus Entrance & Athletic Hall',
    campusArea: 'East Sports Plaza',
    zoneTag: 'Zone 04 · Outdoor Speakers',
    tone: 'brass-bell',
    description:
      'Weather-rated perimeter speakers delivering clear morning arrival, break, and afternoon dismissal signals across open fields.',
    imageSrc: '/frontend/assets/images/school_sports_complex_1794828414298.jpg',
    imageAlt: 'Modern secondary school entrance plaza with academic hall and athletic pavilion',
  },
];

