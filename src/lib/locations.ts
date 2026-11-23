// Offline location dataset for the location picker. Countries are complete (ISO 3166-1);
// cities are a curated list of major business cities. Any other city can be typed in freely.

export interface Country { code: string; name: string; aliases?: string[] }

export const COUNTRIES: Country[] = [
  ["AF","Afghanistan"],["AL","Albania"],["DZ","Algeria"],["AD","Andorra"],["AO","Angola"],["AG","Antigua and Barbuda"],
  ["AR","Argentina"],["AM","Armenia"],["AU","Australia"],["AT","Austria"],["AZ","Azerbaijan"],["BS","Bahamas"],
  ["BH","Bahrain"],["BD","Bangladesh"],["BB","Barbados"],["BY","Belarus"],["BE","Belgium"],["BZ","Belize"],["BJ","Benin"],
  ["BT","Bhutan"],["BO","Bolivia"],["BA","Bosnia and Herzegovina"],["BW","Botswana"],["BR","Brazil"],["BN","Brunei"],
  ["BG","Bulgaria"],["BF","Burkina Faso"],["BI","Burundi"],["KH","Cambodia"],["CM","Cameroon"],["CA","Canada"],
  ["CV","Cape Verde"],["CF","Central African Republic"],["TD","Chad"],["CL","Chile"],["CN","China"],["CO","Colombia"],
  ["KM","Comoros"],["CG","Congo"],["CD","Democratic Republic of the Congo"],["CR","Costa Rica"],["CI","Côte d'Ivoire"],
  ["HR","Croatia"],["CU","Cuba"],["CY","Cyprus"],["CZ","Czechia"],["DK","Denmark"],["DJ","Djibouti"],["DM","Dominica"],
  ["DO","Dominican Republic"],["EC","Ecuador"],["EG","Egypt"],["SV","El Salvador"],["GQ","Equatorial Guinea"],
  ["ER","Eritrea"],["EE","Estonia"],["SZ","Eswatini"],["ET","Ethiopia"],["FJ","Fiji"],["FI","Finland"],["FR","France"],
  ["GA","Gabon"],["GM","Gambia"],["GE","Georgia"],["DE","Germany"],["GH","Ghana"],["GR","Greece"],["GD","Grenada"],
  ["GT","Guatemala"],["GN","Guinea"],["GW","Guinea-Bissau"],["GY","Guyana"],["HT","Haiti"],["HN","Honduras"],
  ["HK","Hong Kong"],["HU","Hungary"],["IS","Iceland"],["IN","India"],["ID","Indonesia"],["IR","Iran"],["IQ","Iraq"],
  ["IE","Ireland"],["IL","Israel"],["IT","Italy"],["JM","Jamaica"],["JP","Japan"],["JO","Jordan"],["KZ","Kazakhstan"],
  ["KE","Kenya"],["KI","Kiribati"],["KW","Kuwait"],["KG","Kyrgyzstan"],["LA","Laos"],["LV","Latvia"],["LB","Lebanon"],
  ["LS","Lesotho"],["LR","Liberia"],["LY","Libya"],["LI","Liechtenstein"],["LT","Lithuania"],["LU","Luxembourg"],
  ["MO","Macao"],["MG","Madagascar"],["MW","Malawi"],["MY","Malaysia"],["MV","Maldives"],["ML","Mali"],["MT","Malta"],
  ["MH","Marshall Islands"],["MR","Mauritania"],["MU","Mauritius"],["MX","Mexico"],["FM","Micronesia"],["MD","Moldova"],
  ["MC","Monaco"],["MN","Mongolia"],["ME","Montenegro"],["MA","Morocco"],["MZ","Mozambique"],["MM","Myanmar"],
  ["NA","Namibia"],["NR","Nauru"],["NP","Nepal"],["NL","Netherlands"],["NZ","New Zealand"],["NI","Nicaragua"],
  ["NE","Niger"],["NG","Nigeria"],["KP","North Korea"],["MK","North Macedonia"],["NO","Norway"],["OM","Oman"],
  ["PK","Pakistan"],["PW","Palau"],["PS","Palestine"],["PA","Panama"],["PG","Papua New Guinea"],["PY","Paraguay"],
  ["PE","Peru"],["PH","Philippines"],["PL","Poland"],["PT","Portugal"],["PR","Puerto Rico"],["QA","Qatar"],
  ["RO","Romania"],["RU","Russia"],["RW","Rwanda"],["KN","Saint Kitts and Nevis"],["LC","Saint Lucia"],
  ["VC","Saint Vincent and the Grenadines"],["WS","Samoa"],["SM","San Marino"],["ST","Sao Tome and Principe"],
  ["SA","Saudi Arabia"],["SN","Senegal"],["RS","Serbia"],["SC","Seychelles"],["SL","Sierra Leone"],["SG","Singapore"],
  ["SK","Slovakia"],["SI","Slovenia"],["SB","Solomon Islands"],["SO","Somalia"],["ZA","South Africa"],["KR","South Korea"],
  ["SS","South Sudan"],["ES","Spain"],["LK","Sri Lanka"],["SD","Sudan"],["SR","Suriname"],["SE","Sweden"],
  ["CH","Switzerland"],["SY","Syria"],["TW","Taiwan"],["TJ","Tajikistan"],["TZ","Tanzania"],["TH","Thailand"],
  ["TL","Timor-Leste"],["TG","Togo"],["TO","Tonga"],["TT","Trinidad and Tobago"],["TN","Tunisia"],["TR","Türkiye"],
  ["TM","Turkmenistan"],["TV","Tuvalu"],["UG","Uganda"],["UA","Ukraine"],["AE","United Arab Emirates"],
  ["GB","United Kingdom"],["US","United States"],["UY","Uruguay"],["UZ","Uzbekistan"],["VU","Vanuatu"],
  ["VA","Vatican City"],["VE","Venezuela"],["VN","Vietnam"],["YE","Yemen"],["ZM","Zambia"],["ZW","Zimbabwe"],
].map(([code, name]) => ({ code, name, aliases: COUNTRY_ALIASES()[code] }));

function COUNTRY_ALIASES(): Record<string, string[]> {
  return {
    GB: ["UK", "Great Britain", "Britain", "England", "Scotland", "Wales", "Northern Ireland"],
    US: ["USA", "United States of America", "America", "U.S.", "U.S.A."],
    AE: ["UAE", "U.A.E.", "Emirates"],
    KR: ["Korea", "Republic of Korea"],
    TR: ["Turkey"],
    CZ: ["Czech Republic"],
    NL: ["Holland", "The Netherlands"],
    RU: ["Russian Federation"],
    CI: ["Ivory Coast"],
    SA: ["KSA"],
  };
}

export const CITIES: Record<string, string[]> = {
  GB: ["London","Manchester","Birmingham","Leeds","Liverpool","Glasgow","Edinburgh","Bristol","Sheffield","Newcastle upon Tyne","Nottingham","Leicester","Cardiff","Belfast","Cambridge","Oxford","Reading","Milton Keynes","Southampton","Brighton"],
  US: ["New York","Los Angeles","Chicago","Houston","Phoenix","Philadelphia","San Antonio","San Diego","Dallas","Austin","San Jose","San Francisco","Seattle","Boston","Denver","Washington","Atlanta","Miami","Nashville","Charlotte","Minneapolis","Detroit","Las Vegas","Portland","Salt Lake City","Raleigh","Tampa","Orlando"],
  PK: ["Karachi","Lahore","Islamabad","Rawalpindi","Faisalabad","Multan","Peshawar","Quetta","Sialkot","Gujranwala","Hyderabad"],
  AE: ["Dubai","Abu Dhabi","Sharjah","Ajman","Ras Al Khaimah","Fujairah","Umm Al Quwain","Al Ain"],
  SA: ["Riyadh","Jeddah","Dammam","Mecca","Medina","Khobar"],
  QA: ["Doha","Al Wakrah","Al Rayyan"],
  IN: ["Mumbai","Delhi","Bengaluru","Hyderabad","Chennai","Kolkata","Pune","Ahmedabad","Gurugram","Noida","Jaipur","Kochi"],
  CA: ["Toronto","Vancouver","Montreal","Calgary","Ottawa","Edmonton","Mississauga","Winnipeg","Quebec City"],
  AU: ["Sydney","Melbourne","Brisbane","Perth","Adelaide","Canberra","Gold Coast"],
  DE: ["Berlin","Munich","Hamburg","Frankfurt","Cologne","Stuttgart","Düsseldorf","Leipzig"],
  FR: ["Paris","Lyon","Marseille","Toulouse","Nice","Lille","Bordeaux","Nantes"],
  NL: ["Amsterdam","Rotterdam","The Hague","Utrecht","Eindhoven"],
  IE: ["Dublin","Cork","Galway","Limerick"],
  ES: ["Madrid","Barcelona","Valencia","Seville","Málaga","Bilbao"],
  IT: ["Rome","Milan","Naples","Turin","Florence","Bologna"],
  SG: ["Singapore"],
  MY: ["Kuala Lumpur","Penang","Johor Bahru","Cyberjaya"],
  ZA: ["Johannesburg","Cape Town","Durban","Pretoria"],
  NG: ["Lagos","Abuja","Port Harcourt","Ibadan"],
  KE: ["Nairobi","Mombasa"],
  EG: ["Cairo","Alexandria","Giza"],
  TR: ["Istanbul","Ankara","Izmir","Bursa"],
  BR: ["São Paulo","Rio de Janeiro","Brasília","Belo Horizonte","Curitiba","Porto Alegre"],
  MX: ["Mexico City","Guadalajara","Monterrey","Puebla","Tijuana"],
  CN: ["Shanghai","Beijing","Shenzhen","Guangzhou","Hangzhou","Chengdu"],
  JP: ["Tokyo","Osaka","Yokohama","Nagoya","Fukuoka"],
  NZ: ["Auckland","Wellington","Christchurch"],
  SE: ["Stockholm","Gothenburg","Malmö"],
  CH: ["Zurich","Geneva","Basel","Lausanne","Bern"],
  BD: ["Dhaka","Chittagong"],
  KW: ["Kuwait City"],
  BH: ["Manama"],
  OM: ["Muscat"],
};

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export function findCountry(input: string | null | undefined): Country | undefined {
  if (!input) return undefined;
  const n = norm(input);
  return COUNTRIES.find(
    (c) => norm(c.name) === n || c.code.toLowerCase() === n || (c.aliases ?? []).some((a) => norm(a) === n),
  );
}

export function sameCountry(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const ca = findCountry(a), cb = findCountry(b);
  if (ca && cb) return ca.code === cb.code;
  return norm(a) === norm(b);
}

export const samePlace = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && norm(a) === norm(b);

export function searchCountries(q: string, limit = 12) {
  const n = norm(q);
  if (!n) return COUNTRIES.slice(0, limit);
  return COUNTRIES.filter(
    (c) => norm(c.name).includes(n) || c.code.toLowerCase() === n || (c.aliases ?? []).some((a) => norm(a).includes(n)),
  ).slice(0, limit);
}

export function searchCities(q: string, countryCode?: string, limit = 15) {
  const n = norm(q);
  const pool = countryCode
    ? (CITIES[countryCode] ?? []).map((city) => ({ city, countryCode }))
    : Object.entries(CITIES).flatMap(([cc, list]) => list.map((city) => ({ city, countryCode: cc })));
  return pool.filter((c) => !n || norm(c.city).includes(n)).slice(0, limit);
}

export const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;
