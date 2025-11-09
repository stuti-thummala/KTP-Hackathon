import { NextResponse } from 'next/server';

const OPENSTATES_PEOPLE_ENDPOINT = 'https://v3.openstates.org/people';
const OPENSTATES_JURISDICTION_PREFIX = 'ocd-jurisdiction/country:us/state';
const MAX_REPRESENTATIVES = 50;

type ZipRule = {
  state: string;
  ranges: Array<{ min: number; max: number }>;
};

const range = (min: number, max: number = min) => ({ min, max });

const ZIP_RULES: ZipRule[] = [
  { state: 'AL', ranges: [range(35000, 36999)] },
  { state: 'AK', ranges: [range(99500, 99999)] },
  { state: 'AZ', ranges: [range(85000, 86999)] },
  {
    state: 'AR',
    ranges: [
      range(71600, 72999),
      range(75502),
    ],
  },
  {
    state: 'CA',
    ranges: [
      range(90000, 96199),
      range(96200, 96699),
    ],
  },
  { state: 'CO', ranges: [range(80000, 81699)] },
  { state: 'CT', ranges: [range(6000, 6999)] },
  {
    state: 'DC',
    ranges: [
      range(20000, 20599),
      range(56900, 56999),
    ],
  },
  { state: 'DE', ranges: [range(19700, 19999)] },
  { state: 'FL', ranges: [range(32000, 34999)] },
  {
    state: 'GA',
    ranges: [
      range(30000, 31999),
      range(39800, 39999),
    ],
  },
  { state: 'HI', ranges: [range(96700, 96999)] },
  { state: 'ID', ranges: [range(83200, 83999)] },
  { state: 'IL', ranges: [range(60000, 62999)] },
  { state: 'IN', ranges: [range(46000, 47999)] },
  { state: 'IA', ranges: [range(50000, 52899)] },
  { state: 'KS', ranges: [range(66000, 67999)] },
  { state: 'KY', ranges: [range(40000, 42799)] },
  { state: 'LA', ranges: [range(70000, 71599)] },
  { state: 'ME', ranges: [range(3900, 4999)] },
  { state: 'MD', ranges: [range(20600, 21999)] },
  {
    state: 'MA',
    ranges: [
      range(1000, 2799),
      range(5501),
      range(5544),
    ],
  },
  { state: 'MI', ranges: [range(48000, 49999)] },
  { state: 'MN', ranges: [range(55000, 56799)] },
  { state: 'MS', ranges: [range(38600, 39799)] },
  { state: 'MO', ranges: [range(63000, 65899)] },
  { state: 'MT', ranges: [range(59000, 59999)] },
  { state: 'NE', ranges: [range(68000, 69399)] },
  { state: 'NV', ranges: [range(88900, 89899)] },
  { state: 'NH', ranges: [range(3000, 3899)] },
  { state: 'NJ', ranges: [range(7000, 8999)] },
  { state: 'NM', ranges: [range(87000, 88499)] },
  {
    state: 'NY',
    ranges: [
      range(501),
      range(544),
      range(6390),
      range(9000, 14999),
    ],
  },
  { state: 'NC', ranges: [range(27000, 28999)] },
  { state: 'ND', ranges: [range(58000, 58899)] },
  { state: 'OH', ranges: [range(43000, 45999)] },
  { state: 'OK', ranges: [range(73000, 74999)] },
  { state: 'OR', ranges: [range(97000, 97999)] },
  { state: 'PA', ranges: [range(15000, 19699)] },
  { state: 'RI', ranges: [range(2800, 2999)] },
  { state: 'SC', ranges: [range(29000, 29999)] },
  { state: 'SD', ranges: [range(57000, 57799)] },
  { state: 'TN', ranges: [range(37000, 38599)] },
  {
    state: 'TX',
    ranges: [
      range(73301, 73399),
      range(75000, 79999),
      range(88500, 88599),
    ],
  },
  { state: 'UT', ranges: [range(84000, 84799)] },
  { state: 'VT', ranges: [range(5000, 5999)] },
  {
    state: 'VA',
    ranges: [
      range(20100, 20199),
      range(22000, 24699),
    ],
  },
  { state: 'WA', ranges: [range(98000, 99499)] },
  { state: 'WV', ranges: [range(24700, 26899)] },
  { state: 'WI', ranges: [range(53000, 54999)] },
  { state: 'WY', ranges: [range(82000, 83199)] },
  {
    state: 'PR',
    ranges: [
      range(600, 799),
      range(900, 999),
    ],
  },
  { state: 'VI', ranges: [range(800, 851)] },
  { state: 'GU', ranges: [range(96910, 96932)] },
  { state: 'AS', ranges: [range(96799)] },
  {
    state: 'MP',
    ranges: [
      range(96950, 96952),
      range(96970),
    ],
  },
];

type OpenStatesOffice = {
  name?: string;
  classification?: string;
  address?: string;
  voice?: string;
  fax?: string;
};

type OpenStatesCurrentRole = {
  title?: string;
  org_classification?: string;
  district?: string;
  division_id?: string;
};

type OpenStatesPerson = {
  id: string;
  name: string;
  party?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
  image?: string;
  openstates_url?: string;
  current_role?: OpenStatesCurrentRole | null;
  offices?: OpenStatesOffice[];
};

type OpenStatesResponse = {
  results?: OpenStatesPerson[];
};

function getStateForZip(zip: string): string | null {
  const numericZip = Number.parseInt(zip, 10);
  if (!Number.isFinite(numericZip)) {
    return null;
  }

  for (const rule of ZIP_RULES) {
    if (rule.ranges.some((range) => numericZip >= range.min && numericZip <= range.max)) {
      return rule.state;
    }
  }

  return null;
}

function buildJurisdiction(state: string): string {
  return `${OPENSTATES_JURISDICTION_PREFIX}:${state.toLowerCase()}/government`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const addressParam = url.searchParams.get('address');
  const zipParam = url.searchParams.get('zip');
  const address = (addressParam ?? zipParam ?? '').trim();

  if (!address) {
    return NextResponse.json(
      { error: 'Missing address or zip query parameter.' },
      { status: 400 },
    );
  }

  const zipFromAddress = !zipParam && addressParam ? addressParam.match(/\b\d{5}\b/)?.[0] ?? null : null;
  const zip = (zipParam ?? zipFromAddress ?? '').trim();
  const state = zip ? getStateForZip(zip) : null;

  if (!zip || !state) {
    return NextResponse.json(
      { error: 'We were unable to map that ZIP code to a supported jurisdiction.' },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENSTATES_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OpenStates API key is not configured on the server.' },
      { status: 500 },
    );
  }

  const endpoint = new URL(OPENSTATES_PEOPLE_ENDPOINT);
  endpoint.searchParams.set('jurisdiction', buildJurisdiction(state));
  endpoint.searchParams.set('include', 'offices');
  endpoint.searchParams.set('per_page', MAX_REPRESENTATIVES.toString());
  endpoint.searchParams.set('page', '1');
  endpoint.searchParams.set('apikey', apiKey);

  try {
    const response = await fetch(endpoint, {
      headers: {
        Accept: 'application/json',
        'x-api-key': apiKey,
      },
      next: { revalidate: 60 * 60 },
    });

    if (!response.ok) {
      const message = `OpenStates API request failed with status ${response.status}`;
      return NextResponse.json({ error: message }, { status: response.status });
    }

    const data = (await response.json()) as OpenStatesResponse;

    const representatives = (data.results ?? [])
      .map((person) => {
        if (!person.current_role) {
          return null;
        }

        const primaryOffice = (person.offices ?? []).find((office) => Boolean(office.voice)) ?? (person.offices ?? [])[0] ?? null;

        const title = person.current_role.title ?? 'Official';
        const district = person.current_role.district ? `District ${person.current_role.district}` : null;
        const officeLabel = district ? `${title} · ${district}` : title;

        return {
          name: person.name,
          office: officeLabel,
          divisionId: person.current_role.division_id ?? null,
          levels: person.current_role.org_classification ? [person.current_role.org_classification] : [],
          party: person.party ?? null,
          email: person.email ?? null,
          phone: primaryOffice?.voice ?? null,
          url: person.openstates_url ?? null,
          photoUrl: person.image ?? null,
        };
      })
      .filter((rep): rep is NonNullable<typeof rep> => Boolean(rep))
      .slice(0, MAX_REPRESENTATIVES);

    return NextResponse.json({
      normalizedInput: {
        state,
        zip,
      },
      representatives,
    });
  } catch (error) {
    console.error('OpenStates API proxy failed:', error);
    return NextResponse.json(
      { error: 'Unable to retrieve representative data at this time.' },
      { status: 502 },
    );
  }
}
