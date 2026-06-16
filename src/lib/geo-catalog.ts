/** Static geo catalog for GEO FOCUS selectors (UI only — does not mutate existing briefings). */

export const GEO_REGIONS = [
  'North America',
  'South America',
  'Europe',
  'Middle East',
  'Africa',
  'Asia-Pacific',
  'Oceania',
] as const

export type GeoRegionName = (typeof GEO_REGIONS)[number]

export const COUNTRIES_BY_REGION: Record<GeoRegionName, readonly string[]> = {
  'North America': [
    'United States',
    'Canada',
    'Mexico',
    'Costa Rica',
    'Panama',
    'Guatemala',
    'Cuba',
    'Dominican Republic',
    'Jamaica',
  ],
  'South America': [
    'Brazil',
    'Argentina',
    'Colombia',
    'Chile',
    'Peru',
    'Venezuela',
    'Ecuador',
    'Uruguay',
    'Paraguay',
    'Bolivia',
  ],
  Europe: [
    'United Kingdom',
    'Germany',
    'France',
    'Italy',
    'Spain',
    'Netherlands',
    'Belgium',
    'Sweden',
    'Norway',
    'Denmark',
    'Poland',
    'Ukraine',
    'Switzerland',
    'Austria',
    'Ireland',
    'Portugal',
    'Greece',
    'European Union',
  ],
  'Middle East': [
    'Israel',
    'Saudi Arabia',
    'United Arab Emirates',
    'Qatar',
    'Turkey',
    'Iran',
    'Iraq',
    'Jordan',
    'Lebanon',
    'Egypt',
  ],
  Africa: [
    'South Africa',
    'Nigeria',
    'Kenya',
    'Ethiopia',
    'Ghana',
    'Morocco',
    'Algeria',
    'Tanzania',
    'Uganda',
    'Senegal',
  ],
  'Asia-Pacific': [
    'China',
    'Japan',
    'South Korea',
    'India',
    'Indonesia',
    'Singapore',
    'Malaysia',
    'Thailand',
    'Vietnam',
    'Philippines',
    'Pakistan',
    'Bangladesh',
    'Taiwan',
    'Hong Kong',
  ],
  Oceania: ['Australia', 'New Zealand', 'Fiji', 'Papua New Guinea'],
}

const US_STATES = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
  'District of Columbia',
] as const

export const STATES_BY_COUNTRY: Record<string, readonly string[]> = {
  'United States': US_STATES,
  Canada: [
    'Alberta',
    'British Columbia',
    'Manitoba',
    'New Brunswick',
    'Newfoundland and Labrador',
    'Nova Scotia',
    'Ontario',
    'Prince Edward Island',
    'Quebec',
    'Saskatchewan',
  ],
  Mexico: [
    'Aguascalientes',
    'Baja California',
    'Chihuahua',
    'Ciudad de México',
    'Jalisco',
    'Nuevo León',
    'Puebla',
    'Quintana Roo',
    'Sinaloa',
    'Yucatán',
  ],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  Germany: [
    'Baden-Württemberg',
    'Bavaria',
    'Berlin',
    'Brandenburg',
    'Hamburg',
    'Hesse',
    'Lower Saxony',
    'North Rhine-Westphalia',
    'Saxony',
  ],
  France: [
    'Auvergne-Rhône-Alpes',
    'Brittany',
    'Grand Est',
    'Île-de-France',
    'Nouvelle-Aquitaine',
    'Occitanie',
    'Provence-Alpes-Côte d\'Azur',
  ],
  Australia: [
    'New South Wales',
    'Queensland',
    'South Australia',
    'Tasmania',
    'Victoria',
    'Western Australia',
  ],
  Brazil: ['São Paulo', 'Rio de Janeiro', 'Minas Gerais', 'Bahia', 'Paraná', 'Rio Grande do Sul'],
  India: ['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat', 'West Bengal', 'Uttar Pradesh'],
}

function stateKey(country: string, state: string): string {
  return `${country}|${state}`
}

/** Major cities/localities keyed by country|state */
export const CITIES_BY_STATE: Record<string, readonly string[]> = {
  [stateKey('United States', 'New York')]: [
    'New York City',
    'Buffalo',
    'Rochester',
    'Albany',
    'Syracuse',
  ],
  [stateKey('United States', 'California')]: [
    'Los Angeles',
    'San Francisco',
    'San Diego',
    'San Jose',
    'Sacramento',
    'Oakland',
  ],
  [stateKey('United States', 'Texas')]: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth'],
  [stateKey('United States', 'Florida')]: ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale'],
  [stateKey('United States', 'Illinois')]: ['Chicago', 'Springfield', 'Naperville', 'Peoria'],
  [stateKey('United States', 'Pennsylvania')]: ['Philadelphia', 'Pittsburgh', 'Harrisburg', 'Allentown'],
  [stateKey('United States', 'Ohio')]: ['Columbus', 'Cleveland', 'Cincinnati', 'Toledo'],
  [stateKey('United States', 'Georgia')]: ['Atlanta', 'Savannah', 'Augusta', 'Columbus'],
  [stateKey('United States', 'Washington')]: ['Seattle', 'Spokane', 'Tacoma', 'Bellevue'],
  [stateKey('United States', 'Colorado')]: ['Denver', 'Colorado Springs', 'Boulder', 'Aurora'],
  [stateKey('United States', 'Massachusetts')]: ['Boston', 'Cambridge', 'Worcester', 'Springfield'],
  [stateKey('United States', 'Arizona')]: ['Phoenix', 'Tucson', 'Mesa', 'Scottsdale'],
  [stateKey('United States', 'Michigan')]: ['Detroit', 'Grand Rapids', 'Ann Arbor', 'Lansing'],
  [stateKey('United States', 'North Carolina')]: ['Charlotte', 'Raleigh', 'Durham', 'Greensboro'],
  [stateKey('United States', 'Virginia')]: ['Virginia Beach', 'Richmond', 'Arlington', 'Norfolk'],
  [stateKey('United States', 'New Jersey')]: ['Newark', 'Jersey City', 'Trenton', 'Atlantic City'],
  [stateKey('United States', 'District of Columbia')]: ['Washington'],
  [stateKey('Canada', 'Ontario')]: ['Toronto', 'Ottawa', 'Hamilton', 'London'],
  [stateKey('Canada', 'Quebec')]: ['Montreal', 'Quebec City', 'Laval', 'Gatineau'],
  [stateKey('Canada', 'British Columbia')]: ['Vancouver', 'Victoria', 'Surrey', 'Burnaby'],
  [stateKey('United Kingdom', 'England')]: ['London', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds'],
  [stateKey('Germany', 'Bavaria')]: ['Munich', 'Nuremberg', 'Augsburg'],
  [stateKey('Australia', 'New South Wales')]: ['Sydney', 'Newcastle', 'Wollongong'],
  [stateKey('Australia', 'Victoria')]: ['Melbourne', 'Geelong', 'Ballarat'],
}

/** ISO 3166-1 alpha-2 → catalog country name */
const ISO_COUNTRY: Record<string, string> = {
  US: 'United States',
  CA: 'Canada',
  MX: 'Mexico',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  AU: 'Australia',
  BR: 'Brazil',
  IN: 'India',
  CN: 'China',
  JP: 'Japan',
}

export function inferRegionFromCountry(country: string): GeoRegionName | undefined {
  const normalized = country.trim()
  for (const region of GEO_REGIONS) {
    if (COUNTRIES_BY_REGION[region].includes(normalized)) return region
  }
  return undefined
}

export function normalizeCountryName(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (ISO_COUNTRY[trimmed.toUpperCase()]) return ISO_COUNTRY[trimmed.toUpperCase()]
  return trimmed
}

export function getCountriesForRegion(region: string | undefined): string[] {
  if (!region) return []
  if (region in COUNTRIES_BY_REGION) {
    return [...COUNTRIES_BY_REGION[region as GeoRegionName]]
  }
  return []
}

export function getStatesForCountry(country: string | undefined): string[] {
  if (!country) return []
  const states = STATES_BY_COUNTRY[country]
  return states ? [...states] : []
}

export function getCitiesForState(country: string | undefined, state: string | undefined): string[] {
  if (!country || !state) return []
  const cities = CITIES_BY_STATE[stateKey(country, state)]
  return cities ? [...cities] : []
}

export function mergeOption(current: string | undefined, options: string[]): string[] {
  if (!current?.trim()) return options
  if (options.includes(current)) return options
  return [current, ...options]
}
