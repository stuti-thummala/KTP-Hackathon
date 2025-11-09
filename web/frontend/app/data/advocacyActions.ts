export type AdvocacyAction = {
  title: string;
  description: string;
  url: string;
  badge: 'petition' | 'clinic' | 'share';
};

const DEFAULT_ACTIONS: AdvocacyAction[] = [
  {
    title: 'Sign the national eyewitness reform pledge',
    description:
      'Tell lawmakers you support double-blind lineups, recorded instructions, and documented witness procedures to prevent wrongful convictions.',
    url: 'https://www.change.org/p/u-s-department-of-justice-mandate-use-of-the-universally-accepted-eyewitness-identification-reform-by-all-law-enforcement-agencies-in-the-u-s-who-receive-federal-financial-assistance-from-the-u-s-department-of-justice',
    badge: 'petition',
  },
  {
    title: 'Join a virtual bias-in-lineups workshop',
    description:
      'Spend 60 minutes with public defenders and researchers learning why traditional eyewitness IDs fail—and what reforms fix them.',
    url: 'https://www.thrivetalent.com/workshops/implicit-bias-virtual-workshop/',
    badge: 'clinic',
  },
  {
    title: 'Share the wrongful conviction explainer toolkit',
    description:
      'Post the social-ready carousel that breaks down eyewitness error statistics so your network understands the stakes.',
    url: 'https://drive.google.com/witnessaware-toolkit',
    badge: 'share',
  },
];

const ACTIONS_BY_STATE: Record<string, AdvocacyAction[]> = {
  CA: [
    {
      title: 'Back California lineup integrity legislation',
      description:
        'Lend your name to bills that require blind administration, sequential lineups, and complete documentation across California.',
      url: 'https://innocenceproject.org/petitions/ca-lineup-integrity',
      badge: 'petition',
    },
    {
      title: 'Volunteer with the Los Angeles court watch coalition',
      description:
        'Sign up for a training shift to document courtroom practices and highlight where eyewitness evidence goes wrong.',
      url: 'https://courtwatchla.org/volunteer',
      badge: 'clinic',
    },
    {
      title: 'Amplify the “Eyes on Justice” social toolkit',
      description:
        'Share the California-specific graphics that explain how misidentifications have shaped cases from the Golden State.',
      url: 'https://witnessaware.org/toolkits/ca-eyes-on-justice',
      badge: 'share',
    },
  ],
  GA: [
    {
      title: 'Support the Georgia eyewitness reform campaign',
      description:
        'Join advocates pushing for statewide standards on recorded instructions and lineup oversight in Georgia.',
      url: 'https://innocenceproject.org/petitions/ga-eyewitness-reform',
      badge: 'petition',
    },
    {
      title: 'Volunteer at the Atlanta Innocence expungement clinic',
      description:
        'Help clear records for people who were exonerated after eyewitness mistakes. Saturday trainings available monthly.',
      url: 'https://georgiainnocence.org/events/clinic',
      badge: 'clinic',
    },
    {
      title: 'Share the “Look Again, Georgia” campaign assets',
      description:
        'Drop the ready-to-post graphics across your socials to explain why lineup reform matters in the Peach State.',
      url: 'https://witnessaware.org/toolkits/look-again-ga',
      badge: 'share',
    },
  ],
};

export function getAdvocacyActionsForState(state?: string | null): AdvocacyAction[] {
  if (!state) {
    return DEFAULT_ACTIONS;
  }

  const uppercase = state.trim().toUpperCase();
  return ACTIONS_BY_STATE[uppercase] ?? DEFAULT_ACTIONS;
}
