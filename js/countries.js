/*
 * Church Hub – countries: what an address looks like in each country (the list of provinces, states, counties…,
 * what the postcode is called), the dialling code, and which privacy law applies (see js/privacy-law.js).
 * The church's own country is chosen in Settings (settings.country, South Africa until changed); each person's address
 * can be in another country. Addresses keep the country's English name (as Elvanto exports it), so older records still fit.
 * Tested with node: tests/countries.test.js.
 *
 * A country with no list (regions: null) gets a box to type in. Lists are each country's top level of local government
 * as people write it on an address; correct or add here (keep each list in A–Z order of how it is written).
 */
var Countries = (function () {
  'use strict';
  // code: [name, continent, regionLabel, regions or null, postcodeLabel, dialling code, law, other names people type]
  var A = 'Africa', E = 'Europe', M = 'Americas', O = 'Oceania';
  var DATA = {
    ZA: ['South Africa', A, 'Province', ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'], 'Postcode', '27', 'popia', ['RSA', 'SA', 'Suid-Afrika', 'Republic of South Africa']],
    NA: ['Namibia', A, 'Region', ['Erongo', 'Hardap', 'Karas', 'Kavango East', 'Kavango West', 'Khomas', 'Kunene', 'Ohangwena', 'Omaheke', 'Omusati', 'Oshana', 'Oshikoto', 'Otjozondjupa', 'Zambezi'], 'Postcode', '264', '', []],
    BW: ['Botswana', A, 'District', ['Central', 'Chobe', 'Ghanzi', 'Kgalagadi', 'Kgatleng', 'Kweneng', 'North-East', 'North-West', 'South-East', 'Southern'], 'Postcode', '267', '', []],
    ZW: ['Zimbabwe', A, 'Province', ['Bulawayo', 'Harare', 'Manicaland', 'Mashonaland Central', 'Mashonaland East', 'Mashonaland West', 'Masvingo', 'Matabeleland North', 'Matabeleland South', 'Midlands'], 'Postcode', '263', '', []],
    ZM: ['Zambia', A, 'Province', ['Central', 'Copperbelt', 'Eastern', 'Luapula', 'Lusaka', 'Muchinga', 'North-Western', 'Northern', 'Southern', 'Western'], 'Postcode', '260', '', []],
    MZ: ['Mozambique', A, 'Province', ['Cabo Delgado', 'Gaza', 'Inhambane', 'Manica', 'Maputo', 'Maputo City', 'Nampula', 'Niassa', 'Sofala', 'Tete', 'Zambézia'], 'Postcode', '258', '', ['Moçambique']],
    LS: ['Lesotho', A, 'District', ['Berea', 'Butha-Buthe', 'Leribe', 'Mafeteng', 'Maseru', 'Mohale’s Hoek', 'Mokhotlong', 'Qacha’s Nek', 'Quthing', 'Thaba-Tseka'], 'Postcode', '266', '', []],
    SZ: ['Eswatini', A, 'Region', ['Hhohho', 'Lubombo', 'Manzini', 'Shiselweni'], 'Postcode', '268', '', ['Swaziland']],
    MW: ['Malawi', A, 'Region', ['Central', 'Northern', 'Southern'], 'Postcode', '265', '', []],
    AO: ['Angola', A, 'Province', null, 'Postcode', '244', '', []],
    KE: ['Kenya', A, 'County', ['Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado', 'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia', 'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', 'Murang’a', 'Nairobi', 'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River', 'Tharaka-Nithi', 'Trans-Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot'], 'Postal code', '254', '', []],
    UG: ['Uganda', A, 'Region', ['Central', 'Eastern', 'Northern', 'Western'], 'Postcode', '256', '', []],
    TZ: ['Tanzania', A, 'Region', ['Arusha', 'Dar es Salaam', 'Dodoma', 'Geita', 'Iringa', 'Kagera', 'Kaskazini Pemba', 'Kaskazini Unguja', 'Katavi', 'Kigoma', 'Kilimanjaro', 'Kusini Pemba', 'Kusini Unguja', 'Lindi', 'Manyara', 'Mara', 'Mbeya', 'Mjini Magharibi', 'Morogoro', 'Mtwara', 'Mwanza', 'Njombe', 'Pwani', 'Rukwa', 'Ruvuma', 'Shinyanga', 'Simiyu', 'Singida', 'Songwe', 'Tabora', 'Tanga'], 'Postcode', '255', '', []],
    RW: ['Rwanda', A, 'Province', ['Eastern', 'Kigali City', 'Northern', 'Southern', 'Western'], 'Postcode', '250', '', []],
    ET: ['Ethiopia', A, 'Region', ['Addis Ababa', 'Afar', 'Amhara', 'Benishangul-Gumuz', 'Central Ethiopia', 'Dire Dawa', 'Gambela', 'Harari', 'Oromia', 'Sidama', 'Somali', 'South Ethiopia', 'South West Ethiopia', 'Tigray'], 'Postcode', '251', '', []],
    NG: ['Nigeria', A, 'State', ['Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Federal Capital Territory', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'], 'Postal code', '234', '', []],
    GH: ['Ghana', A, 'Region', ['Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North'], 'Postcode', '233', '', []],
    CM: ['Cameroon', A, 'Region', ['Adamawa', 'Centre', 'East', 'Far North', 'Littoral', 'North', 'Northwest', 'South', 'Southwest', 'West'], 'Postcode', '237', '', ['Cameroun']],
    CD: ['DR Congo', A, 'Province', ['Bas-Uélé', 'Équateur', 'Haut-Katanga', 'Haut-Lomami', 'Haut-Uélé', 'Ituri', 'Kasaï', 'Kasaï-Central', 'Kasaï-Oriental', 'Kinshasa', 'Kongo-Central', 'Kwango', 'Kwilu', 'Lomami', 'Lualaba', 'Mai-Ndombe', 'Maniema', 'Mongala', 'Nord-Kivu', 'Nord-Ubangi', 'Sankuru', 'Sud-Kivu', 'Sud-Ubangi', 'Tanganyika', 'Tshopo', 'Tshuapa'], 'Postcode', '243', '', ['Democratic Republic of the Congo', 'DRC', 'Congo-Kinshasa']],

    GB: ['United Kingdom', E, 'County', null, 'Postcode', '44', 'ukgdpr', ['UK', 'Great Britain', 'England', 'Scotland', 'Wales', 'Northern Ireland']],
    IE: ['Ireland', E, 'County', ['Carlow', 'Cavan', 'Clare', 'Cork', 'Donegal', 'Dublin', 'Galway', 'Kerry', 'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon', 'Sligo', 'Tipperary', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow'], 'Eircode', '353', 'gdpr', ['Republic of Ireland', 'Éire']],
    DE: ['Germany', E, 'State', ['Baden-Württemberg', 'Bayern', 'Berlin', 'Brandenburg', 'Bremen', 'Hamburg', 'Hessen', 'Mecklenburg-Vorpommern', 'Niedersachsen', 'Nordrhein-Westfalen', 'Rheinland-Pfalz', 'Saarland', 'Sachsen', 'Sachsen-Anhalt', 'Schleswig-Holstein', 'Thüringen'], 'Postal code', '49', 'gdpr', ['Deutschland']],
    AT: ['Austria', E, 'State', ['Burgenland', 'Kärnten', 'Niederösterreich', 'Oberösterreich', 'Salzburg', 'Steiermark', 'Tirol', 'Vorarlberg', 'Wien'], 'Postal code', '43', 'gdpr', ['Österreich']],
    CH: ['Switzerland', E, 'Canton', ['Aargau', 'Appenzell Ausserrhoden', 'Appenzell Innerrhoden', 'Basel-Landschaft', 'Basel-Stadt', 'Bern', 'Fribourg', 'Genève', 'Glarus', 'Graubünden', 'Jura', 'Luzern', 'Neuchâtel', 'Nidwalden', 'Obwalden', 'Schaffhausen', 'Schwyz', 'Solothurn', 'St. Gallen', 'Thurgau', 'Ticino', 'Uri', 'Valais', 'Vaud', 'Zug', 'Zürich'], 'Postal code', '41', 'fadp', ['Schweiz', 'Suisse', 'Svizzera']],
    NL: ['Netherlands', E, 'Province', ['Drenthe', 'Flevoland', 'Friesland', 'Gelderland', 'Groningen', 'Limburg', 'Noord-Brabant', 'Noord-Holland', 'Overijssel', 'Utrecht', 'Zeeland', 'Zuid-Holland'], 'Postal code', '31', 'gdpr', ['Nederland', 'Holland', 'The Netherlands']],
    BE: ['Belgium', E, 'Province', ['Antwerpen', 'Brabant wallon', 'Brussels', 'Hainaut', 'Liège', 'Limburg', 'Luxembourg', 'Namur', 'Oost-Vlaanderen', 'Vlaams-Brabant', 'West-Vlaanderen'], 'Postal code', '32', 'gdpr', ['België', 'Belgique']],
    FR: ['France', E, 'Region', ['Auvergne-Rhône-Alpes', 'Bourgogne-Franche-Comté', 'Bretagne', 'Centre-Val de Loire', 'Corse', 'Grand Est', 'Guadeloupe', 'Guyane', 'Hauts-de-France', 'Île-de-France', 'La Réunion', 'Martinique', 'Mayotte', 'Normandie', 'Nouvelle-Aquitaine', 'Occitanie', 'Pays de la Loire', 'Provence-Alpes-Côte d’Azur'], 'Postal code', '33', 'gdpr', []],
    ES: ['Spain', E, 'Autonomous community', ['Andalucía', 'Aragón', 'Asturias', 'Canarias', 'Cantabria', 'Castilla y León', 'Castilla-La Mancha', 'Cataluña', 'Ceuta', 'Comunidad de Madrid', 'Comunitat Valenciana', 'Extremadura', 'Galicia', 'Illes Balears', 'La Rioja', 'Melilla', 'Navarra', 'País Vasco', 'Región de Murcia'], 'Postal code', '34', 'gdpr', ['España']],
    PT: ['Portugal', E, 'District', ['Açores', 'Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco', 'Coimbra', 'Évora', 'Faro', 'Guarda', 'Leiria', 'Lisboa', 'Madeira', 'Portalegre', 'Porto', 'Santarém', 'Setúbal', 'Viana do Castelo', 'Vila Real', 'Viseu'], 'Postal code', '351', 'gdpr', []],
    IT: ['Italy', E, 'Region', ['Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna', 'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche', 'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia', 'Toscana', 'Trentino-Alto Adige', 'Umbria', 'Valle d’Aosta', 'Veneto'], 'Postal code', '39', 'gdpr', ['Italia']],
    PL: ['Poland', E, 'Voivodeship', ['dolnośląskie', 'kujawsko-pomorskie', 'lubelskie', 'lubuskie', 'łódzkie', 'małopolskie', 'mazowieckie', 'opolskie', 'podkarpackie', 'podlaskie', 'pomorskie', 'śląskie', 'świętokrzyskie', 'warmińsko-mazurskie', 'wielkopolskie', 'zachodniopomorskie'], 'Postal code', '48', 'gdpr', ['Polska']],
    DK: ['Denmark', E, 'Region', ['Hovedstaden', 'Midtjylland', 'Nordjylland', 'Sjælland', 'Syddanmark'], 'Postal code', '45', 'gdpr', ['Danmark']],
    NO: ['Norway', E, 'County', null, 'Postal code', '47', 'gdpr', ['Norge']],
    SE: ['Sweden', E, 'County', null, 'Postal code', '46', 'gdpr', ['Sverige']],
    FI: ['Finland', E, 'Region', null, 'Postal code', '358', 'gdpr', ['Suomi']],

    US: ['United States', M, 'State', ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'], 'ZIP code', '1', 'us', ['USA', 'US', 'United States of America', 'America']],
    CA: ['Canada', M, 'Province or territory', ['Alberta', 'British Columbia', 'Manitoba', 'New Brunswick', 'Newfoundland and Labrador', 'Northwest Territories', 'Nova Scotia', 'Nunavut', 'Ontario', 'Prince Edward Island', 'Quebec', 'Saskatchewan', 'Yukon'], 'Postal code', '1', 'pipeda', []],
    MX: ['Mexico', M, 'State', ['Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua', 'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero', 'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla', 'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas'], 'Postal code', '52', '', ['México']],
    JM: ['Jamaica', M, 'Parish', ['Clarendon', 'Hanover', 'Kingston', 'Manchester', 'Portland', 'Saint Andrew', 'Saint Ann', 'Saint Catherine', 'Saint Elizabeth', 'Saint James', 'Saint Mary', 'Saint Thomas', 'Trelawny', 'Westmoreland'], 'Postal code', '1', '', []],
    BR: ['Brazil', M, 'State', ['Acre', 'Alagoas', 'Amapá', 'Amazonas', 'Bahia', 'Ceará', 'Distrito Federal', 'Espírito Santo', 'Goiás', 'Maranhão', 'Mato Grosso', 'Mato Grosso do Sul', 'Minas Gerais', 'Pará', 'Paraíba', 'Paraná', 'Pernambuco', 'Piauí', 'Rio de Janeiro', 'Rio Grande do Norte', 'Rio Grande do Sul', 'Rondônia', 'Roraima', 'Santa Catarina', 'São Paulo', 'Sergipe', 'Tocantins'], 'CEP', '55', 'lgpd', ['Brasil']],
    AR: ['Argentina', M, 'Province', ['Buenos Aires', 'Catamarca', 'Chaco', 'Chubut', 'Ciudad Autónoma de Buenos Aires', 'Córdoba', 'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja', 'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan', 'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero', 'Tierra del Fuego', 'Tucumán'], 'Postal code', '54', '', []],
    CL: ['Chile', M, 'Region', ['Antofagasta', 'Arica y Parinacota', 'Atacama', 'Aysén', 'Biobío', 'Coquimbo', 'La Araucanía', 'Los Lagos', 'Los Ríos', 'Magallanes', 'Maule', 'Metropolitana de Santiago', 'Ñuble', 'O’Higgins', 'Tarapacá', 'Valparaíso'], 'Postal code', '56', '', []],
    CO: ['Colombia', M, 'Department', ['Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'], 'Postal code', '57', '', []],
    PE: ['Peru', M, 'Region', null, 'Postal code', '51', '', ['Perú']],

    AU: ['Australia', O, 'State or territory', ['Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia'], 'Postcode', '61', 'au', []],
    NZ: ['New Zealand', O, 'Region', ['Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawke’s Bay', 'Manawatū-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago', 'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast'], 'Postcode', '64', 'nz', ['Aotearoa']]
  };
  var CONTINENTS = [A, E, M, O];
  var DEFAULT = 'ZA';

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, ''); }
  function info(code) {
    var d = DATA[code]; if (!d) return null;
    return { code: code, name: d[0], continent: d[1], regionLabel: d[2], regions: d[3] ? d[3].slice().sort(function (a, b) { return a.localeCompare(b); }) : null, postcodeLabel: d[4], dial: d[5], law: d[6] || 'general', aliases: d[7].slice() };
  }
  /** The country for a code ("ZA") or a name as typed ("South Africa", "RSA", "uk"); null when it isn't in the list. */
  function find(v) {
    if (!v) return null;
    if (DATA[v]) return info(v);
    if (DATA[String(v).toUpperCase()] && String(v).length === 2) return info(String(v).toUpperCase());
    var n = norm(v);
    for (var c in DATA) { if (norm(DATA[c][0]) === n || DATA[c][7].some(function (a) { return norm(a) === n; })) return info(c); }
    return null;
  }
  /** The church's country (Settings), South Africa until it is chosen. */
  function church(settings) { return find(settings && settings.country) || info(DEFAULT); }
  /** An address's country: its own if it has one we know, otherwise the church's. */
  function ofAddress(address, settings) { return (address && find(address.country)) || (address && address.country ? null : church(settings)); }
  /** Every country, A–Z, optionally grouped by continent: [{ continent, countries: [...] }]. */
  function all() { return Object.keys(DATA).map(info).sort(function (a, b) { return a.name.localeCompare(b.name); }); }
  function grouped() { var xs = all(); return CONTINENTS.map(function (c) { return { continent: c, countries: xs.filter(function (x) { return x.continent === c; }) }; }); }
  /** A region as people type it ("kzn", "Kwazulu Natal", "gauteng") → the name in the country's list; otherwise as typed. */
  var SHORT = { ZA: { kzn: 'KwaZulu-Natal', gp: 'Gauteng', wc: 'Western Cape', ec: 'Eastern Cape', fs: 'Free State', ofs: 'Free State', nw: 'North West', nc: 'Northern Cape', mp: 'Mpumalanga', lp: 'Limpopo', natal: 'KwaZulu-Natal' },
    US: { al: 'Alabama', ak: 'Alaska', az: 'Arizona', ar: 'Arkansas', ca: 'California', co: 'Colorado', ct: 'Connecticut', de: 'Delaware', dc: 'District of Columbia', fl: 'Florida', ga: 'Georgia', hi: 'Hawaii', id: 'Idaho', il: 'Illinois', in: 'Indiana', ia: 'Iowa', ks: 'Kansas', ky: 'Kentucky', la: 'Louisiana', me: 'Maine', md: 'Maryland', ma: 'Massachusetts', mi: 'Michigan', mn: 'Minnesota', ms: 'Mississippi', mo: 'Missouri', mt: 'Montana', ne: 'Nebraska', nv: 'Nevada', nh: 'New Hampshire', nj: 'New Jersey', nm: 'New Mexico', ny: 'New York', nc: 'North Carolina', nd: 'North Dakota', oh: 'Ohio', ok: 'Oklahoma', or: 'Oregon', pa: 'Pennsylvania', ri: 'Rhode Island', sc: 'South Carolina', sd: 'South Dakota', tn: 'Tennessee', tx: 'Texas', ut: 'Utah', vt: 'Vermont', va: 'Virginia', wa: 'Washington', wv: 'West Virginia', wi: 'Wisconsin', wy: 'Wyoming' },
    CA: { ab: 'Alberta', bc: 'British Columbia', mb: 'Manitoba', nb: 'New Brunswick', nl: 'Newfoundland and Labrador', nt: 'Northwest Territories', ns: 'Nova Scotia', nu: 'Nunavut', on: 'Ontario', pe: 'Prince Edward Island', pei: 'Prince Edward Island', qc: 'Quebec', sk: 'Saskatchewan', yt: 'Yukon' },
    AU: { act: 'Australian Capital Territory', nsw: 'New South Wales', nt: 'Northern Territory', qld: 'Queensland', sa: 'South Australia', tas: 'Tasmania', vic: 'Victoria', wa: 'Western Australia' } };
  function region(v, code) {
    var s = String(v || '').trim(), c = info(code || DEFAULT); if (!s || !c) return s;
    var n = norm(s), sh = SHORT[c.code] && SHORT[c.code][n]; if (sh) return sh;
    var hit = (c.regions || []).filter(function (r) { return norm(r) === n; })[0];
    return hit || s;
  }
  /** A phone number to compare two records by: its last 9 digits, so "+27 82 000 1234", "0820001234" and "082 000 1234" match. */
  function phoneKey(s) { var d = String(s || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; }

  return { DEFAULT: DEFAULT, CONTINENTS: CONTINENTS, find: find, church: church, ofAddress: ofAddress, all: all, grouped: grouped, region: region, phoneKey: phoneKey };
})();
if (typeof module !== 'undefined') module.exports = Countries;
