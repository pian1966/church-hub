/*
 * Church & Trellis – countries: what an address looks like in each country (the list of provinces, states, counties…,
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
  var A = 'Africa', S = 'Asia', E = 'Europe', M = 'Americas', O = 'Oceania';
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

    IN: ['India', S, 'State', null, 'PIN code', '91', '', ['Bharat']],
    KH: ['Cambodia', S, 'Province', null, 'Postal code', '855', '', ['Kampuchea']],

    AU: ['Australia', O, 'State or territory', ['Australian Capital Territory', 'New South Wales', 'Northern Territory', 'Queensland', 'South Australia', 'Tasmania', 'Victoria', 'Western Australia'], 'Postcode', '61', 'au', []],
    NZ: ['New Zealand', O, 'Region', ['Auckland', 'Bay of Plenty', 'Canterbury', 'Gisborne', 'Hawke’s Bay', 'Manawatū-Whanganui', 'Marlborough', 'Nelson', 'Northland', 'Otago', 'Southland', 'Taranaki', 'Tasman', 'Waikato', 'Wellington', 'West Coast'], 'Postcode', '64', 'nz', ['Aotearoa']]
  };
  var CONTINENTS = [A, S, E, M, O];
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
  /** The date of birth in a national ID number, where the number carries one: South Africa (13 digits, YYMMDD first, last
   * digit a Luhn check). today ('YYYY-MM-DD') decides the century. '' when the number doesn't say (or isn't valid). */
  function birthFromId(id, code, today) {
    var d = String(id || '').replace(/\s+/g, '');
    if ((code || DEFAULT) !== 'ZA' || !/^\d{13}$/.test(d)) return '';
    var sum = 0; for (var i = 0; i < 13; i++) { var n = +d.charAt(12 - i); if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; }
    if (sum % 10) return '';
    today = today || new Date().toISOString().slice(0, 10);
    var yy = +d.slice(0, 2), y = (yy <= +today.slice(2, 4) ? 2000 : 1900) + yy, iso = y + '-' + d.slice(2, 4) + '-' + d.slice(4, 6);
    var dt = new Date(iso + 'T00:00:00Z');
    if (isNaN(dt) || dt.toISOString().slice(0, 10) !== iso || iso > today) return '';
    return iso;
  }
  // Where each country is: [south, north, west, east] in degrees, drawn generously (islands and territories included), only to catch a mistyped
  // minus sign or swapped numbers on a home address's latitude and longitude – never to refuse anyone.
  var BOX = {
    ZA: [-35.2, -22, 16.3, 33.1], NA: [-29, -16.9, 11.5, 25.4], BW: [-27, -17.7, 19.9, 29.4], ZW: [-22.5, -15.5, 25.2, 33.1], ZM: [-18.1, -8.2, 21.9, 33.7],
    MZ: [-27, -10.4, 30.2, 41], LS: [-30.7, -28.5, 27, 29.5], SZ: [-27.4, -25.7, 30.7, 32.2], MW: [-17.2, -9.3, 32.6, 36], AO: [-18.1, -4.3, 11.6, 24.1],
    KE: [-4.8, 5.1, 33.8, 42], UG: [-1.5, 4.3, 29.5, 35.1], TZ: [-11.8, -0.9, 29.3, 40.5], RW: [-2.9, -1, 28.8, 30.9], ET: [3.3, 15, 32.9, 48.1],
    NG: [4.2, 13.9, 2.6, 14.8], GH: [4.6, 11.2, -3.3, 1.3], CM: [1.6, 13.1, 8.4, 16.3], CD: [-13.5, 5.5, 12.1, 31.4],
    GB: [49.8, 60.9, -8.7, 1.9], IE: [51.3, 55.5, -10.8, -5.9], DE: [47.2, 55.1, 5.8, 15.1], AT: [46.3, 49.1, 9.5, 17.2], CH: [45.7, 47.9, 5.9, 10.6],
    FR: [41.2, 51.2, -5.2, 9.7], ES: [27.5, 43.9, -18.3, 4.4], PT: [32.3, 42.2, -31.4, -6.1], IT: [35.4, 47.2, 6.5, 18.6], NL: [50.7, 53.6, 3.3, 7.3],
    BE: [49.4, 51.6, 2.5, 6.5], DK: [54.5, 57.8, 8, 15.3], NO: [57.9, 71.3, 4.4, 31.2], SE: [55.2, 69.1, 10.9, 24.2], FI: [59.7, 70.2, 19.4, 31.7], PL: [48.9, 54.9, 14, 24.2],
    CA: [41.6, 83.2, -141.1, -52.5], US: [18.8, 71.5, -179.2, -66.8], MX: [14.4, 32.8, -118.5, -86.6], BR: [-33.8, 5.3, -74.1, -34.7], AR: [-55.1, -21.7, -73.7, -53.5],
    CL: [-56, -17.4, -110, -66.4], CO: [-4.3, 13.5, -79.1, -66.8], PE: [-18.4, 0, -81.4, -68.6], JM: [17.7, 18.6, -78.4, -76.1],
    IN: [6.7, 35.7, 68, 97.5], KH: [10.3, 14.7, 102.3, 107.7], AU: [-43.8, -9, 112.8, 154], NZ: [-47.4, -34.3, 165.8, 179]
  };
  function inBox(code, lat, lng) { var b = BOX[code]; return !b || (lat >= b[0] && lat <= b[1] && lng >= b[2] && lng <= b[3]); }
  /**
   * Latitude and longitude as people write them – "-29.4833, 30.2333", "-29.4833 30.2333", "29.4833° S, 30.2333° E", "S29.4833 E30.2333",
   * a comma for the decimal point ("-29,4833; 30,2333") – as { lat, lng, decimals } (decimals: the fewest places after the point), or
   * { error } where error is 'empty-pair' (not two numbers), 'zero' (0, 0 is a spot in the sea), 'range' (beyond 90 / 180) or 'swapped'
   * (longitude first: the first number is beyond 90 but the second isn't). Degrees-minutes-seconds are not read: they give 'empty-pair' or 'minutes'.
   */
  function parseGps(text) {
    var s = String(text == null ? '' : text).replace(/[−–—]/g, '-').replace(/[′’']/g, "'").replace(/[″”"]/g, '"').trim();
    if (!s) return { error: 'empty' };
    if (/\d\s*(°|º)?\s*\d+\s*['"]/.test(s) || /\d\s*'\s*\d/.test(s)) return { error: 'minutes' };
    var re = /([NSEW])?\s*(-?\d+(?:[.,]\d+)?)\s*[°º]?\s*([NSEW])?/gi, m, got = [];
    while ((m = re.exec(s))) got.push({ v: m[2], l: String(m[1] || m[3] || '').toUpperCase() });
    if (got.length !== 2) return { error: 'empty-pair' };
    var vals = got.map(function (g) { var n = parseFloat(g.v.replace(',', '.')); if (g.l === 'S' || g.l === 'W') n = -Math.abs(n); return n; });
    var dec = got.map(function (g) { var d = g.v.split(/[.,]/)[1]; return d ? d.length : 0; });
    var lat = vals[0], lng = vals[1], dl = dec[0], dg = dec[1];
    if (/^[EW]$/.test(got[0].l) || /^[NS]$/.test(got[1].l)) { lat = vals[1]; lng = vals[0]; dl = dec[1]; dg = dec[0]; }   // "30.2E 29.4S": longitude first
    if (isNaN(lat) || isNaN(lng)) return { error: 'empty-pair' };
    if (Math.abs(lat) > 90 && Math.abs(lng) <= 90 && !got[0].l) return { error: 'swapped' };
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return { error: 'range' };
    if (lat === 0 && lng === 0) return { error: 'zero' };
    return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, decimals: Math.min(dl, dg) };
  }
  /** How it is shown and kept as text: "-29.4833, 30.2333". */
  function gpsText(lat, lng) { return lat + ', ' + lng; }
  /**
   * Does the spot fit the country? null when it does (or the country isn't known here); otherwise
   * { kind: 'flip', lat, lng } – it would fit with a sign changed or the two numbers the other way round (the likely mistake) – or { kind: 'outside' }.
   */
  function gpsCheck(lat, lng, code) {
    if (!BOX[code] || inBox(code, lat, lng)) return null;
    var tries = [[-lat, lng], [lat, -lng], [lng, lat], [-lat, -lng]];
    for (var i = 0; i < tries.length; i++) if (Math.abs(tries[i][0]) <= 90 && inBox(code, tries[i][0], tries[i][1])) return { kind: 'flip', lat: tries[i][0], lng: tries[i][1] };
    return { kind: 'outside' };
  }
  /** Metres between two spots (a straight line over the ground). */
  function metres(a, b) {
    var R = 6371000, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function phoneKey(s) { var d = String(s || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; }

  return { DEFAULT: DEFAULT, CONTINENTS: CONTINENTS, find: find, church: church, ofAddress: ofAddress, all: all, grouped: grouped, region: region, phoneKey: phoneKey, birthFromId: birthFromId, parseGps: parseGps, gpsText: gpsText, gpsCheck: gpsCheck, metres: metres };
})();
if (typeof module !== 'undefined') module.exports = Countries;
