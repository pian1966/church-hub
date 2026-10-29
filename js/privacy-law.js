/*
 * Church Hub – the privacy law the Privacy pages follow, from the church's country (Settings → Country).
 * South Africa: POPIA. EU and EEA: GDPR. UK: UK GDPR. Others as listed; any other country gets general wording.
 * Each law: short name, full name, what the responsible person is called, the regulator, whether the church may have to
 * register, what to do after a breach, how many days to answer a request, and the clause that gives a copy of one's data.
 * Checked October 2026 – laws change: correct here (and tell the church). Not legal advice. Tested: tests/privacy-law.test.js.
 */
var PrivacyLaw = (function () {
  'use strict';
  var C = typeof Countries !== 'undefined' ? Countries : (typeof require === 'function' ? require('./countries.js') : null);
  // short, name, officer, regulator, register (a to-do, or ''), breach, days to answer, the right to a copy
  var LAWS = {
    popia: ['POPIA', 'Protection of Personal Information Act (POPIA)', 'Information Officer', 'Information Regulator', 'Register the Information Officer on the Information Regulator’s portal.', 'Tell the Information Regulator and the people affected as soon as reasonably possible.', 30, 'POPIA section 23'],
    gdpr: ['GDPR', 'General Data Protection Regulation (GDPR)', 'Data protection lead', 'data protection authority', '', 'Tell the data protection authority within 72 hours of finding out (unless it is unlikely to harm anyone), and the people affected without delay if the risk to them is high.', 30, 'GDPR Article 15'],
    ukgdpr: ['UK GDPR', 'UK GDPR and the Data Protection Act 2018', 'Data protection lead', 'Information Commissioner’s Office (ICO)', 'Check whether the church must pay the ICO’s data protection fee (many not-for-profits are exempt).', 'Tell the ICO within 72 hours of finding out (unless it is unlikely to harm anyone), and the people affected without delay if the risk to them is high.', 30, 'UK GDPR Article 15'],
    fadp: ['FADP', 'Federal Act on Data Protection (FADP)', 'Data protection lead', 'Federal Data Protection and Information Commissioner (FDPIC)', '', 'Tell the FDPIC as soon as possible if the breach is likely to put people at high risk.', 30, 'FADP Article 25'],
    us: ['privacy law', 'US state privacy and data breach laws', 'Privacy lead', 'your state Attorney General', '', 'Every state has a data breach law: tell the people affected (and, in many states, the Attorney General) as your state’s law requires.', 45, 'state privacy law'],
    pipeda: ['PIPEDA', 'PIPEDA and your province’s privacy law (e.g. Quebec’s Law 25)', 'Privacy Officer', 'Office of the Privacy Commissioner of Canada', '', 'If there is a real risk of significant harm, tell the Privacy Commissioner and the people affected as soon as feasible.', 30, 'PIPEDA'],
    au: ['Privacy Act', 'Privacy Act 1988', 'Privacy Officer', 'Office of the Australian Information Commissioner (OAIC)', '', 'Assess a suspected breach within 30 days; if serious harm is likely, tell the OAIC and the people affected as soon as practicable.', 30, 'Australian Privacy Principle 12'],
    nz: ['Privacy Act', 'Privacy Act 2020', 'Privacy Officer', 'Office of the Privacy Commissioner', '', 'If serious harm is likely, tell the Privacy Commissioner and the people affected as soon as practicable.', 20, 'Privacy Act 2020, principle 6'],
    lgpd: ['LGPD', 'Lei Geral de Proteção de Dados (LGPD)', 'Encarregado (Data Protection Officer)', 'Autoridade Nacional de Proteção de Dados (ANPD)', '', 'Tell the ANPD and the people affected within 3 working days of finding out if the incident may cause them significant harm.', 15, 'LGPD Article 18'],
    kenya: ['Data Protection Act', 'Data Protection Act, 2019', 'Data protection officer', 'Office of the Data Protection Commissioner (ODPC)', 'Check whether the church must register with the ODPC as a data controller.', 'Tell the Data Commissioner within 72 hours of finding out, and the people affected as soon as practical.', 30, 'Data Protection Act, 2019'],
    nigeria: ['NDPA', 'Nigeria Data Protection Act 2023 (NDPA)', 'Data protection officer', 'Nigeria Data Protection Commission (NDPC)', 'Check whether the church must register with the NDPC.', 'Tell the NDPC within 72 hours of finding out, and the people affected without delay if the risk to them is high.', 30, 'NDPA'],
    zimbabwe: ['CDPA', 'Cyber and Data Protection Act (CDPA)', 'Data protection officer', 'POTRAZ (the Data Protection Authority)', 'Data controllers need a licence from POTRAZ – check whether the church needs one.', 'Tell POTRAZ within 24 hours of finding out, and the people affected within 72 hours if the risk to them is high.', 30, 'Cyber and Data Protection Act'],
    botswana: ['Data Protection Act', 'Data Protection Act, 2024', 'Data protection officer', 'Information and Data Protection Commission', 'Check whether the church must register with the Commission.', 'Tell the Commission within 72 hours of finding out.', 30, 'Data Protection Act'],
    rwanda: ['Data Protection Law', 'Law on the Protection of Personal Data and Privacy', 'Data protection officer', 'National Cyber Security Authority (NCSA)', 'Data controllers must register with the NCSA.', 'Tell the NCSA within 48 hours of finding out.', 30, 'Data Protection Law'],
    malawi: ['Data Protection Act', 'Data Protection Act, 2024', 'Data protection officer', 'Malawi Communications Regulatory Authority (MACRA)', 'Check whether the church must register with MACRA.', 'Tell MACRA and the people affected as soon as possible.', 30, 'Data Protection Act'],
    ethiopia: ['Data Protection Proclamation', 'Personal Data Protection Proclamation No. 1321/2024', 'Data protection officer', 'the data protection authority', 'Check whether the church must register.', 'Tell the authority and the people affected as soon as possible.', 30, 'Personal Data Protection Proclamation'],
    mexico: ['LFPDPPP', 'Federal Law on the Protection of Personal Data Held by Private Parties (2025)', 'Data protection lead', 'Secretaría Anticorrupción y Buen Gobierno', '', 'Tell the people affected without delay so they can protect themselves.', 20, 'LFPDPPP (ARCO rights)'],
    chile: ['Data Protection Law', 'Law 21,719 on Personal Data Protection (in force from 1 December 2026)', 'Data protection lead', 'Personal Data Protection Agency', '', 'Tell the Agency and the people affected as soon as possible.', 30, 'Law 21,719'],
    general: ['privacy law', 'your country’s data protection law', 'Privacy lead', 'the data protection authority', '', 'Tell the people affected – and your country’s data protection authority, if the law requires it – as soon as possible.', 30, 'privacy law']
  };
  var BY_COUNTRY = { KE: 'kenya', NG: 'nigeria', ZW: 'zimbabwe', BW: 'botswana', RW: 'rwanda', MW: 'malawi', ET: 'ethiopia', MX: 'mexico', CL: 'chile' };
  // The national data protection authority, for countries under the GDPR
  var DPA = { IE: 'Data Protection Commission', DE: 'data protection authority of your state (or your church’s own data protection officer – many German churches follow church data protection law instead)', AT: 'Datenschutzbehörde', NL: 'Autoriteit Persoonsgegevens', BE: 'Data Protection Authority (GBA / APD)', FR: 'CNIL', ES: 'Agencia Española de Protección de Datos (AEPD)', PT: 'Comissão Nacional de Proteção de Dados (CNPD)', IT: 'Garante per la protezione dei dati personali', PL: 'Personal Data Protection Office (UODO)', DK: 'Datatilsynet', NO: 'Datatilsynet', SE: 'Integritetsskyddsmyndigheten (IMY)', FI: 'Office of the Data Protection Ombudsman' };

  function make(key, code) {
    var l = LAWS[key] || LAWS.general, reg = key === 'gdpr' && DPA[code] ? DPA[code] : l[3];
    return { key: LAWS[key] ? key : 'general', short: l[0], name: l[1], officer: l[2], regulator: reg, register: l[4], breach: key === 'gdpr' && DPA[code] ? l[5].replace('the data protection authority', 'the ' + reg) : l[5], days: l[6], copyRight: l[7] };
  }
  /** The law for a country code ("ZA") or the church's settings ({ country: 'KE' }). */
  function forCountry(code) {
    var c = C && C.find(code); if (!c) return make('popia', 'ZA');
    return make(BY_COUNTRY[c.code] || c.law, c.code);
  }
  function forChurch(settings) { return forCountry(C ? C.church(settings).code : 'ZA'); }

  return { LAWS: LAWS, forCountry: forCountry, forChurch: forChurch };
})();
if (typeof module !== 'undefined') module.exports = PrivacyLaw;
