export interface Timezone {
  value: string;
  label: string;
  offset: string;
}

export const TIMEZONES: Timezone[] = [
  // Africa
  { value: "Africa/Abidjan", label: "Abidjan Time", offset: "UTC+0" },
  { value: "Africa/Accra", label: "Ghana Mean Time", offset: "UTC+0" },
  { value: "Africa/Addis_Ababa", label: "East Africa Time", offset: "UTC+3" },
  { value: "Africa/Algiers", label: "Central European Time", offset: "UTC+1" },
  { value: "Africa/Asmara", label: "East Africa Time", offset: "UTC+3" },
  { value: "Africa/Bamako", label: "Greenwich Mean Time", offset: "UTC+0" },
  { value: "Africa/Bangui", label: "West Africa Time", offset: "UTC+1" },
  { value: "Africa/Banjul", label: "Greenwich Mean Time", offset: "UTC+0" },
  { value: "Africa/Bissau", label: "Greenwich Mean Time", offset: "UTC+0" },
  { value: "Africa/Blantyre", label: "Central Africa Time", offset: "UTC+2" },
  { value: "Africa/Brazzaville", label: "West Africa Time", offset: "UTC+1" },
  { value: "Africa/Bujumbura", label: "Central Africa Time", offset: "UTC+2" },
  { value: "Africa/Cairo", label: "Eastern European Time", offset: "UTC+2" },
  {
    value: "Africa/Casablanca",
    label: "Western European Time",
    offset: "UTC+1",
  },
  { value: "Africa/Ceuta", label: "Central European Time", offset: "UTC+1" },
  { value: "Africa/Conakry", label: "Greenwich Mean Time", offset: "UTC+0" },
  { value: "Africa/Dakar", label: "Greenwich Mean Time", offset: "UTC+0" },
  { value: "Africa/Dar_es_Salaam", label: "East Africa Time", offset: "UTC+3" },
  { value: "Africa/Djibouti", label: "East Africa Time", offset: "UTC+3" },
  { value: "Africa/Douala", label: "West Africa Time", offset: "UTC+1" },
  { value: "Africa/El_Aaiun", label: "Western European Time", offset: "UTC+1" },
  { value: "Africa/Freetown", label: "Greenwich Mean Time", offset: "UTC+0" },
  { value: "Africa/Gaborone", label: "Central Africa Time", offset: "UTC+2" },
  { value: "Africa/Harare", label: "Central Africa Time", offset: "UTC+2" },
  {
    value: "Africa/Johannesburg",
    label: "South Africa Standard Time",
    offset: "UTC+2",
  },
  { value: "Africa/Juba", label: "East Africa Time", offset: "UTC+3" },
  { value: "Africa/Kampala", label: "East Africa Time", offset: "UTC+3" },
  { value: "Africa/Khartoum", label: "Central Africa Time", offset: "UTC+2" },
  { value: "Africa/Kigali", label: "Central Africa Time", offset: "UTC+2" },
  { value: "Africa/Kinshasa", label: "West Africa Time", offset: "UTC+1" },
  { value: "Africa/Lagos", label: "West Africa Time", offset: "UTC+1" },
  { value: "Africa/Libreville", label: "West Africa Time", offset: "UTC+1" },
  { value: "Africa/Lome", label: "Greenwich Mean Time", offset: "UTC+0" },
  { value: "Africa/Luanda", label: "West Africa Time", offset: "UTC+1" },
  { value: "Africa/Lubumbashi", label: "Central Africa Time", offset: "UTC+2" },
  { value: "Africa/Lusaka", label: "Central Africa Time", offset: "UTC+2" },
  { value: "Africa/Malabo", label: "West Africa Time", offset: "UTC+1" },
  { value: "Africa/Maputo", label: "Central Africa Time", offset: "UTC+2" },
  {
    value: "Africa/Maseru",
    label: "South Africa Standard Time",
    offset: "UTC+2",
  },
  {
    value: "Africa/Mbabane",
    label: "South Africa Standard Time",
    offset: "UTC+2",
  },
  { value: "Africa/Mogadishu", label: "East Africa Time", offset: "UTC+3" },
  { value: "Africa/Monrovia", label: "Greenwich Mean Time", offset: "UTC+0" },
  { value: "Africa/Nairobi", label: "East Africa Time", offset: "UTC+3" },
  { value: "Africa/Ndjamena", label: "West Africa Time", offset: "UTC+1" },
  { value: "Africa/Niamey", label: "West Africa Time", offset: "UTC+1" },
  { value: "Africa/Nouakchott", label: "Greenwich Mean Time", offset: "UTC+0" },
  {
    value: "Africa/Ouagadougou",
    label: "Greenwich Mean Time",
    offset: "UTC+0",
  },
  { value: "Africa/Porto-Novo", label: "West Africa Time", offset: "UTC+1" },
  { value: "Africa/Sao_Tome", label: "Greenwich Mean Time", offset: "UTC+0" },
  { value: "Africa/Tripoli", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Africa/Tunis", label: "Central European Time", offset: "UTC+1" },
  { value: "Africa/Windhoek", label: "Central Africa Time", offset: "UTC+2" },

  // America/North America
  { value: "America/Adak", label: "Hawaii-Aleutian Time", offset: "UTC-10" },
  { value: "America/Anchorage", label: "Alaska Time", offset: "UTC-9" },
  { value: "America/Anguilla", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Antigua", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Araguaina", label: "Brasilia Time", offset: "UTC-3" },
  {
    value: "America/Argentina/Buenos_Aires",
    label: "Argentina Time",
    offset: "UTC-3",
  },
  {
    value: "America/Argentina/Catamarca",
    label: "Argentina Time",
    offset: "UTC-3",
  },
  {
    value: "America/Argentina/Cordoba",
    label: "Argentina Time",
    offset: "UTC-3",
  },
  {
    value: "America/Argentina/Jujuy",
    label: "Argentina Time",
    offset: "UTC-3",
  },
  {
    value: "America/Argentina/La_Rioja",
    label: "Argentina Time",
    offset: "UTC-3",
  },
  {
    value: "America/Argentina/Mendoza",
    label: "Argentina Time",
    offset: "UTC-3",
  },
  {
    value: "America/Argentina/Rio_Gallegos",
    label: "Argentina Time",
    offset: "UTC-3",
  },
  {
    value: "America/Argentina/Salta",
    label: "Argentina Time",
    offset: "UTC-3",
  },
  {
    value: "America/Argentina/San_Juan",
    label: "Argentina Time",
    offset: "UTC-3",
  },
  {
    value: "America/Argentina/San_Luis",
    label: "Argentina Time",
    offset: "UTC-3",
  },
  {
    value: "America/Argentina/Tucuman",
    label: "Argentina Time",
    offset: "UTC-3",
  },
  {
    value: "America/Argentina/Ushuaia",
    label: "Argentina Time",
    offset: "UTC-3",
  },
  { value: "America/Aruba", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Asuncion", label: "Paraguay Time", offset: "UTC-3" },
  { value: "America/Atikokan", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Bahia", label: "Brasilia Time", offset: "UTC-3" },
  { value: "America/Bahia_Banderas", label: "Central Time", offset: "UTC-6" },
  { value: "America/Barbados", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Belem", label: "Brasilia Time", offset: "UTC-3" },
  { value: "America/Belize", label: "Central Time", offset: "UTC-6" },
  { value: "America/Blanc-Sablon", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Boa_Vista", label: "Amazon Time", offset: "UTC-4" },
  { value: "America/Bogota", label: "Colombia Time", offset: "UTC-5" },
  { value: "America/Boise", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Cambridge_Bay", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Campo_Grande", label: "Amazon Time", offset: "UTC-4" },
  { value: "America/Cancun", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Caracas", label: "Venezuela Time", offset: "UTC-4" },
  { value: "America/Cayenne", label: "French Guiana Time", offset: "UTC-3" },
  { value: "America/Cayman", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Chicago", label: "Central Time", offset: "UTC-6" },
  { value: "America/Chihuahua", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Costa_Rica", label: "Central Time", offset: "UTC-6" },
  { value: "America/Creston", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Cuiaba", label: "Amazon Time", offset: "UTC-4" },
  { value: "America/Curacao", label: "Atlantic Time", offset: "UTC-4" },
  {
    value: "America/Danmarkshavn",
    label: "Greenwich Mean Time",
    offset: "UTC+0",
  },
  { value: "America/Dawson", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Dawson_Creek", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Denver", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Detroit", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Dominica", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Edmonton", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Eirunepe", label: "Acre Time", offset: "UTC-5" },
  { value: "America/El_Salvador", label: "Central Time", offset: "UTC-6" },
  { value: "America/Fort_Nelson", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Fortaleza", label: "Brasilia Time", offset: "UTC-3" },
  { value: "America/Glace_Bay", label: "Atlantic Time", offset: "UTC-4" },
  {
    value: "America/Godthab",
    label: "Western Greenland Time",
    offset: "UTC-3",
  },
  { value: "America/Goose_Bay", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Grand_Turk", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Grenada", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Guadeloupe", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Guatemala", label: "Central Time", offset: "UTC-6" },
  { value: "America/Guayaquil", label: "Ecuador Time", offset: "UTC-5" },
  { value: "America/Guyana", label: "Guyana Time", offset: "UTC-4" },
  { value: "America/Halifax", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Havana", label: "Cuba Time", offset: "UTC-5" },
  { value: "America/Hermosillo", label: "Mountain Time", offset: "UTC-7" },
  {
    value: "America/Indiana/Indianapolis",
    label: "Eastern Time",
    offset: "UTC-5",
  },
  { value: "America/Indiana/Knox", label: "Central Time", offset: "UTC-6" },
  { value: "America/Indiana/Marengo", label: "Eastern Time", offset: "UTC-5" },
  {
    value: "America/Indiana/Petersburg",
    label: "Eastern Time",
    offset: "UTC-5",
  },
  {
    value: "America/Indiana/Tell_City",
    label: "Central Time",
    offset: "UTC-6",
  },
  { value: "America/Indiana/Vevay", label: "Eastern Time", offset: "UTC-5" },
  {
    value: "America/Indiana/Vincennes",
    label: "Eastern Time",
    offset: "UTC-5",
  },
  { value: "America/Indiana/Winamac", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Inuvik", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Iqaluit", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Jamaica", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Juneau", label: "Alaska Time", offset: "UTC-9" },
  {
    value: "America/Kentucky/Louisville",
    label: "Eastern Time",
    offset: "UTC-5",
  },
  {
    value: "America/Kentucky/Monticello",
    label: "Eastern Time",
    offset: "UTC-5",
  },
  { value: "America/Kralendijk", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/La_Paz", label: "Bolivia Time", offset: "UTC-4" },
  { value: "America/Lima", label: "Peru Time", offset: "UTC-5" },
  { value: "America/Los_Angeles", label: "Pacific Time", offset: "UTC-8" },
  { value: "America/Lower_Princes", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Maceio", label: "Brasilia Time", offset: "UTC-3" },
  { value: "America/Managua", label: "Central Time", offset: "UTC-6" },
  { value: "America/Manaus", label: "Amazon Time", offset: "UTC-4" },
  { value: "America/Marigot", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Martinique", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Matamoros", label: "Central Time", offset: "UTC-6" },
  { value: "America/Mazatlan", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Menominee", label: "Central Time", offset: "UTC-6" },
  { value: "America/Merida", label: "Central Time", offset: "UTC-6" },
  { value: "America/Metlakatla", label: "Alaska Time", offset: "UTC-9" },
  { value: "America/Mexico_City", label: "Central Time", offset: "UTC-6" },
  {
    value: "America/Miquelon",
    label: "St. Pierre & Miquelon Time",
    offset: "UTC-3",
  },
  { value: "America/Moncton", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Monterrey", label: "Central Time", offset: "UTC-6" },
  { value: "America/Montevideo", label: "Uruguay Time", offset: "UTC-3" },
  { value: "America/Montserrat", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Nassau", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/New_York", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Nipigon", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Nome", label: "Alaska Time", offset: "UTC-9" },
  {
    value: "America/Noronha",
    label: "Fernando de Noronha Time",
    offset: "UTC-2",
  },
  {
    value: "America/North_Dakota/Beulah",
    label: "Central Time",
    offset: "UTC-6",
  },
  {
    value: "America/North_Dakota/Center",
    label: "Central Time",
    offset: "UTC-6",
  },
  {
    value: "America/North_Dakota/New_Salem",
    label: "Central Time",
    offset: "UTC-6",
  },
  { value: "America/Ojinaga", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Panama", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Pangnirtung", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Paramaribo", label: "Suriname Time", offset: "UTC-3" },
  { value: "America/Phoenix", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Port-au-Prince", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Port_of_Spain", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Porto_Velho", label: "Amazon Time", offset: "UTC-4" },
  { value: "America/Puerto_Rico", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Punta_Arenas", label: "Chile Time", offset: "UTC-3" },
  { value: "America/Rainy_River", label: "Central Time", offset: "UTC-6" },
  { value: "America/Rankin_Inlet", label: "Central Time", offset: "UTC-6" },
  { value: "America/Recife", label: "Brasilia Time", offset: "UTC-3" },
  { value: "America/Regina", label: "Central Time", offset: "UTC-6" },
  { value: "America/Resolute", label: "Central Time", offset: "UTC-6" },
  { value: "America/Rio_Branco", label: "Acre Time", offset: "UTC-5" },
  { value: "America/Santarem", label: "Brasilia Time", offset: "UTC-3" },
  { value: "America/Santiago", label: "Chile Time", offset: "UTC-4" },
  { value: "America/Santo_Domingo", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Sao_Paulo", label: "Brasilia Time", offset: "UTC-3" },
  {
    value: "America/Scoresbysund",
    label: "Eastern Greenland Time",
    offset: "UTC-1",
  },
  { value: "America/Sitka", label: "Alaska Time", offset: "UTC-9" },
  { value: "America/St_Barthelemy", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/St_Johns", label: "Newfoundland Time", offset: "UTC-3:30" },
  { value: "America/St_Kitts", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/St_Lucia", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/St_Thomas", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/St_Vincent", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Swift_Current", label: "Central Time", offset: "UTC-6" },
  { value: "America/Tegucigalpa", label: "Central Time", offset: "UTC-6" },
  { value: "America/Thule", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Thunder_Bay", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Tijuana", label: "Pacific Time", offset: "UTC-8" },
  { value: "America/Toronto", label: "Eastern Time", offset: "UTC-5" },
  { value: "America/Tortola", label: "Atlantic Time", offset: "UTC-4" },
  { value: "America/Vancouver", label: "Pacific Time", offset: "UTC-8" },
  { value: "America/Whitehorse", label: "Mountain Time", offset: "UTC-7" },
  { value: "America/Winnipeg", label: "Central Time", offset: "UTC-6" },
  { value: "America/Yakutat", label: "Alaska Time", offset: "UTC-9" },
  { value: "America/Yellowknife", label: "Mountain Time", offset: "UTC-7" },

  // Antarctica
  { value: "Antarctica/Casey", label: "Casey Time", offset: "UTC+11" },
  { value: "Antarctica/Davis", label: "Davis Time", offset: "UTC+7" },
  {
    value: "Antarctica/DumontDUrville",
    label: "Dumont-d'Urville Time",
    offset: "UTC+10",
  },
  {
    value: "Antarctica/Macquarie",
    label: "Macquarie Island Time",
    offset: "UTC+11",
  },
  { value: "Antarctica/Mawson", label: "Mawson Time", offset: "UTC+5" },
  { value: "Antarctica/McMurdo", label: "New Zealand Time", offset: "UTC+12" },
  { value: "Antarctica/Palmer", label: "Chile Time", offset: "UTC-3" },
  { value: "Antarctica/Rothera", label: "Rothera Time", offset: "UTC-3" },
  { value: "Antarctica/Syowa", label: "Syowa Time", offset: "UTC+3" },
  {
    value: "Antarctica/Troll",
    label: "Coordinated Universal Time",
    offset: "UTC+0",
  },
  { value: "Antarctica/Vostok", label: "Vostok Time", offset: "UTC+6" },

  // Arctic
  {
    value: "Arctic/Longyearbyen",
    label: "Central European Time",
    offset: "UTC+1",
  },

  // Asia
  { value: "Asia/Aden", label: "Arabia Standard Time", offset: "UTC+3" },
  { value: "Asia/Almaty", label: "Almaty Time", offset: "UTC+6" },
  { value: "Asia/Amman", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Asia/Anadyr", label: "Anadyr Time", offset: "UTC+12" },
  { value: "Asia/Aqtau", label: "Aqtau Time", offset: "UTC+5" },
  { value: "Asia/Aqtobe", label: "Aqtobe Time", offset: "UTC+5" },
  { value: "Asia/Ashgabat", label: "Turkmenistan Time", offset: "UTC+5" },
  { value: "Asia/Atyrau", label: "West Kazakhstan Time", offset: "UTC+5" },
  { value: "Asia/Baghdad", label: "Arabia Standard Time", offset: "UTC+3" },
  { value: "Asia/Bahrain", label: "Arabia Standard Time", offset: "UTC+3" },
  { value: "Asia/Baku", label: "Azerbaijan Time", offset: "UTC+4" },
  { value: "Asia/Bangkok", label: "Indochina Time", offset: "UTC+7" },
  { value: "Asia/Barnaul", label: "Barnaul Time", offset: "UTC+7" },
  { value: "Asia/Beirut", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Asia/Bishkek", label: "Kyrgyzstan Time", offset: "UTC+6" },
  { value: "Asia/Brunei", label: "Brunei Darussalam Time", offset: "UTC+8" },
  { value: "Asia/Chita", label: "Yakutsk Time", offset: "UTC+9" },
  { value: "Asia/Choibalsan", label: "Choibalsan Time", offset: "UTC+8" },
  { value: "Asia/Colombo", label: "India Standard Time", offset: "UTC+5:30" },
  { value: "Asia/Damascus", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Asia/Dhaka", label: "Bangladesh Standard Time", offset: "UTC+6" },
  { value: "Asia/Dili", label: "Timor-Leste Time", offset: "UTC+9" },
  { value: "Asia/Dubai", label: "Gulf Standard Time", offset: "UTC+4" },
  { value: "Asia/Dushanbe", label: "Tajikistan Time", offset: "UTC+5" },
  { value: "Asia/Famagusta", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Asia/Gaza", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Asia/Hebron", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Asia/Ho_Chi_Minh", label: "Indochina Time", offset: "UTC+7" },
  { value: "Asia/Hong_Kong", label: "Hong Kong Time", offset: "UTC+8" },
  { value: "Asia/Hovd", label: "Hovd Time", offset: "UTC+7" },
  { value: "Asia/Irkutsk", label: "Irkutsk Time", offset: "UTC+8" },
  { value: "Asia/Jakarta", label: "Western Indonesia Time", offset: "UTC+7" },
  { value: "Asia/Jayapura", label: "Eastern Indonesia Time", offset: "UTC+9" },
  { value: "Asia/Jerusalem", label: "Israel Standard Time", offset: "UTC+2" },
  { value: "Asia/Kabul", label: "Afghanistan Time", offset: "UTC+4:30" },
  {
    value: "Asia/Kamchatka",
    label: "Petropavlovsk-Kamchatski Time",
    offset: "UTC+12",
  },
  { value: "Asia/Karachi", label: "Pakistan Standard Time", offset: "UTC+5" },
  { value: "Asia/Kathmandu", label: "Nepal Time", offset: "UTC+5:45" },
  { value: "Asia/Khandyga", label: "Yakutsk Time", offset: "UTC+9" },
  { value: "Asia/Kolkata", label: "India Standard Time", offset: "UTC+5:30" },
  { value: "Asia/Krasnoyarsk", label: "Krasnoyarsk Time", offset: "UTC+7" },
  { value: "Asia/Kuala_Lumpur", label: "Malaysia Time", offset: "UTC+8" },
  { value: "Asia/Kuching", label: "Malaysia Time", offset: "UTC+8" },
  { value: "Asia/Kuwait", label: "Arabia Standard Time", offset: "UTC+3" },
  { value: "Asia/Macau", label: "China Standard Time", offset: "UTC+8" },
  { value: "Asia/Magadan", label: "Magadan Time", offset: "UTC+11" },
  { value: "Asia/Makassar", label: "Central Indonesia Time", offset: "UTC+8" },
  { value: "Asia/Manila", label: "Philippine Standard Time", offset: "UTC+8" },
  { value: "Asia/Muscat", label: "Gulf Standard Time", offset: "UTC+4" },
  { value: "Asia/Nicosia", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Asia/Novokuznetsk", label: "Krasnoyarsk Time", offset: "UTC+7" },
  { value: "Asia/Novosibirsk", label: "Novosibirsk Time", offset: "UTC+7" },
  { value: "Asia/Omsk", label: "Omsk Time", offset: "UTC+6" },
  { value: "Asia/Oral", label: "West Kazakhstan Time", offset: "UTC+5" },
  { value: "Asia/Phnom_Penh", label: "Indochina Time", offset: "UTC+7" },
  { value: "Asia/Pontianak", label: "Western Indonesia Time", offset: "UTC+7" },
  { value: "Asia/Pyongyang", label: "Pyongyang Time", offset: "UTC+9" },
  { value: "Asia/Qatar", label: "Arabia Standard Time", offset: "UTC+3" },
  { value: "Asia/Qostanay", label: "East Kazakhstan Time", offset: "UTC+6" },
  { value: "Asia/Qyzylorda", label: "Qyzylorda Time", offset: "UTC+5" },
  { value: "Asia/Riyadh", label: "Arabia Standard Time", offset: "UTC+3" },
  { value: "Asia/Sakhalin", label: "Sakhalin Time", offset: "UTC+11" },
  { value: "Asia/Samarkand", label: "Uzbekistan Time", offset: "UTC+5" },
  { value: "Asia/Seoul", label: "Korea Standard Time", offset: "UTC+9" },
  { value: "Asia/Shanghai", label: "China Standard Time", offset: "UTC+8" },
  {
    value: "Asia/Singapore",
    label: "Singapore Standard Time",
    offset: "UTC+8",
  },
  {
    value: "Asia/Srednekolymsk",
    label: "Srednekolymsk Time",
    offset: "UTC+11",
  },
  { value: "Asia/Taipei", label: "China Standard Time", offset: "UTC+8" },
  { value: "Asia/Tashkent", label: "Uzbekistan Time", offset: "UTC+5" },
  { value: "Asia/Tbilisi", label: "Georgia Standard Time", offset: "UTC+4" },
  { value: "Asia/Tehran", label: "Iran Standard Time", offset: "UTC+3:30" },
  { value: "Asia/Thimphu", label: "Bhutan Time", offset: "UTC+6" },
  { value: "Asia/Tokyo", label: "Japan Standard Time", offset: "UTC+9" },
  { value: "Asia/Tomsk", label: "Tomsk Time", offset: "UTC+7" },
  { value: "Asia/Ulaanbaatar", label: "Ulaanbaatar Time", offset: "UTC+8" },
  { value: "Asia/Urumqi", label: "China Standard Time", offset: "UTC+8" },
  { value: "Asia/Ust-Nera", label: "Vladivostok Time", offset: "UTC+10" },
  { value: "Asia/Vientiane", label: "Indochina Time", offset: "UTC+7" },
  { value: "Asia/Vladivostok", label: "Vladivostok Time", offset: "UTC+10" },
  { value: "Asia/Yakutsk", label: "Yakutsk Time", offset: "UTC+9" },
  { value: "Asia/Yangon", label: "Myanmar Time", offset: "UTC+6:30" },
  { value: "Asia/Yekaterinburg", label: "Yekaterinburg Time", offset: "UTC+5" },
  { value: "Asia/Yerevan", label: "Armenia Time", offset: "UTC+4" },

  // Atlantic
  { value: "Atlantic/Azores", label: "Azores Time", offset: "UTC-1" },
  { value: "Atlantic/Bermuda", label: "Atlantic Time", offset: "UTC-4" },
  { value: "Atlantic/Canary", label: "Western European Time", offset: "UTC+0" },
  { value: "Atlantic/Cape_Verde", label: "Cape Verde Time", offset: "UTC-1" },
  { value: "Atlantic/Faroe", label: "Western European Time", offset: "UTC+0" },
  {
    value: "Atlantic/Madeira",
    label: "Western European Time",
    offset: "UTC+0",
  },
  {
    value: "Atlantic/Reykjavik",
    label: "Greenwich Mean Time",
    offset: "UTC+0",
  },
  {
    value: "Atlantic/South_Georgia",
    label: "South Georgia Time",
    offset: "UTC-2",
  },
  {
    value: "Atlantic/St_Helena",
    label: "Greenwich Mean Time",
    offset: "UTC+0",
  },
  {
    value: "Atlantic/Stanley",
    label: "Falkland Islands Time",
    offset: "UTC-3",
  },

  // Australia
  {
    value: "Australia/Adelaide",
    label: "Australian Central Time",
    offset: "UTC+9:30",
  },
  {
    value: "Australia/Brisbane",
    label: "Australian Eastern Time",
    offset: "UTC+10",
  },
  {
    value: "Australia/Broken_Hill",
    label: "Australian Central Time",
    offset: "UTC+9:30",
  },
  {
    value: "Australia/Currie",
    label: "Australian Eastern Time",
    offset: "UTC+10",
  },
  {
    value: "Australia/Darwin",
    label: "Australian Central Time",
    offset: "UTC+9:30",
  },
  {
    value: "Australia/Eucla",
    label: "Australian Central Western Time",
    offset: "UTC+8:45",
  },
  {
    value: "Australia/Hobart",
    label: "Australian Eastern Time",
    offset: "UTC+10",
  },
  {
    value: "Australia/Lindeman",
    label: "Australian Eastern Time",
    offset: "UTC+10",
  },
  {
    value: "Australia/Lord_Howe",
    label: "Lord Howe Time",
    offset: "UTC+10:30",
  },
  {
    value: "Australia/Melbourne",
    label: "Australian Eastern Time",
    offset: "UTC+10",
  },
  {
    value: "Australia/Perth",
    label: "Australian Western Time",
    offset: "UTC+8",
  },
  {
    value: "Australia/Sydney",
    label: "Australian Eastern Time",
    offset: "UTC+10",
  },

  // Europe
  {
    value: "Europe/Amsterdam",
    label: "Central European Time",
    offset: "UTC+1",
  },
  { value: "Europe/Andorra", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Astrakhan", label: "Astrakhan Time", offset: "UTC+4" },
  { value: "Europe/Athens", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Europe/Belgrade", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Berlin", label: "Central European Time", offset: "UTC+1" },
  {
    value: "Europe/Bratislava",
    label: "Central European Time",
    offset: "UTC+1",
  },
  { value: "Europe/Brussels", label: "Central European Time", offset: "UTC+1" },
  {
    value: "Europe/Bucharest",
    label: "Eastern European Time",
    offset: "UTC+2",
  },
  { value: "Europe/Budapest", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Busingen", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Chisinau", label: "Eastern European Time", offset: "UTC+2" },
  {
    value: "Europe/Copenhagen",
    label: "Central European Time",
    offset: "UTC+1",
  },
  { value: "Europe/Dublin", label: "Greenwich Mean Time", offset: "UTC+0" },
  {
    value: "Europe/Gibraltar",
    label: "Central European Time",
    offset: "UTC+1",
  },
  { value: "Europe/Guernsey", label: "Greenwich Mean Time", offset: "UTC+0" },
  { value: "Europe/Helsinki", label: "Eastern European Time", offset: "UTC+2" },
  {
    value: "Europe/Isle_of_Man",
    label: "Greenwich Mean Time",
    offset: "UTC+0",
  },
  { value: "Europe/Istanbul", label: "Turkey Time", offset: "UTC+3" },
  { value: "Europe/Jersey", label: "Greenwich Mean Time", offset: "UTC+0" },
  {
    value: "Europe/Kaliningrad",
    label: "Eastern European Time",
    offset: "UTC+2",
  },
  { value: "Europe/Kiev", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Europe/Kirov", label: "Moscow Time", offset: "UTC+3" },
  { value: "Europe/Lisbon", label: "Western European Time", offset: "UTC+0" },
  {
    value: "Europe/Ljubljana",
    label: "Central European Time",
    offset: "UTC+1",
  },
  { value: "Europe/London", label: "Greenwich Mean Time", offset: "UTC+0" },
  {
    value: "Europe/Luxembourg",
    label: "Central European Time",
    offset: "UTC+1",
  },
  { value: "Europe/Madrid", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Malta", label: "Central European Time", offset: "UTC+1" },
  {
    value: "Europe/Mariehamn",
    label: "Eastern European Time",
    offset: "UTC+2",
  },
  { value: "Europe/Minsk", label: "Moscow Time", offset: "UTC+3" },
  { value: "Europe/Monaco", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Moscow", label: "Moscow Time", offset: "UTC+3" },
  { value: "Europe/Oslo", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Paris", label: "Central European Time", offset: "UTC+1" },
  {
    value: "Europe/Podgorica",
    label: "Central European Time",
    offset: "UTC+1",
  },
  { value: "Europe/Prague", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Riga", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Europe/Rome", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Samara", label: "Samara Time", offset: "UTC+4" },
  {
    value: "Europe/San_Marino",
    label: "Central European Time",
    offset: "UTC+1",
  },
  { value: "Europe/Sarajevo", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Saratov", label: "Saratov Time", offset: "UTC+4" },
  { value: "Europe/Simferopol", label: "Moscow Time", offset: "UTC+3" },
  { value: "Europe/Skopje", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Sofia", label: "Eastern European Time", offset: "UTC+2" },
  {
    value: "Europe/Stockholm",
    label: "Central European Time",
    offset: "UTC+1",
  },
  { value: "Europe/Tallinn", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Europe/Tirane", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Ulyanovsk", label: "Ulyanovsk Time", offset: "UTC+4" },
  { value: "Europe/Uzhgorod", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Europe/Vaduz", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Vatican", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Vienna", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Vilnius", label: "Eastern European Time", offset: "UTC+2" },
  { value: "Europe/Volgograd", label: "Volgograd Time", offset: "UTC+4" },
  { value: "Europe/Warsaw", label: "Central European Time", offset: "UTC+1" },
  { value: "Europe/Zagreb", label: "Central European Time", offset: "UTC+1" },
  {
    value: "Europe/Zaporozhye",
    label: "Eastern European Time",
    offset: "UTC+2",
  },
  { value: "Europe/Zurich", label: "Central European Time", offset: "UTC+1" },

  // Indian Ocean
  { value: "Indian/Antananarivo", label: "East Africa Time", offset: "UTC+3" },
  { value: "Indian/Chagos", label: "Indian Ocean Time", offset: "UTC+6" },
  {
    value: "Indian/Christmas",
    label: "Christmas Island Time",
    offset: "UTC+7",
  },
  { value: "Indian/Cocos", label: "Cocos Islands Time", offset: "UTC+6:30" },
  { value: "Indian/Comoro", label: "East Africa Time", offset: "UTC+3" },
  {
    value: "Indian/Kerguelen",
    label: "French Southern & Antarctic Time",
    offset: "UTC+5",
  },
  { value: "Indian/Mahe", label: "Seychelles Time", offset: "UTC+4" },
  { value: "Indian/Maldives", label: "Maldives Time", offset: "UTC+5" },
  { value: "Indian/Mauritius", label: "Mauritius Time", offset: "UTC+4" },
  { value: "Indian/Mayotte", label: "East Africa Time", offset: "UTC+3" },
  { value: "Indian/Reunion", label: "Réunion Time", offset: "UTC+4" },

  // Pacific
  { value: "Pacific/Apia", label: "Apia Time", offset: "UTC+13" },
  { value: "Pacific/Auckland", label: "New Zealand Time", offset: "UTC+12" },
  {
    value: "Pacific/Bougainville",
    label: "Bougainville Time",
    offset: "UTC+11",
  },
  { value: "Pacific/Chatham", label: "Chatham Time", offset: "UTC+12:45" },
  { value: "Pacific/Chuuk", label: "Chuuk Time", offset: "UTC+10" },
  { value: "Pacific/Easter", label: "Easter Island Time", offset: "UTC-6" },
  { value: "Pacific/Efate", label: "Vanuatu Time", offset: "UTC+11" },
  {
    value: "Pacific/Enderbury",
    label: "Phoenix Islands Time",
    offset: "UTC+13",
  },
  { value: "Pacific/Fakaofo", label: "Tokelau Time", offset: "UTC+13" },
  { value: "Pacific/Fiji", label: "Fiji Time", offset: "UTC+12" },
  { value: "Pacific/Funafuti", label: "Tuvalu Time", offset: "UTC+12" },
  { value: "Pacific/Galapagos", label: "Galápagos Time", offset: "UTC-6" },
  { value: "Pacific/Gambier", label: "Gambier Time", offset: "UTC-9" },
  {
    value: "Pacific/Guadalcanal",
    label: "Solomon Islands Time",
    offset: "UTC+11",
  },
  { value: "Pacific/Guam", label: "Chamorro Time", offset: "UTC+10" },
  {
    value: "Pacific/Honolulu",
    label: "Hawaii-Aleutian Time",
    offset: "UTC-10",
  },
  { value: "Pacific/Kiritimati", label: "Line Islands Time", offset: "UTC+14" },
  { value: "Pacific/Kosrae", label: "Kosrae Time", offset: "UTC+11" },
  {
    value: "Pacific/Kwajalein",
    label: "Marshall Islands Time",
    offset: "UTC+12",
  },
  { value: "Pacific/Majuro", label: "Marshall Islands Time", offset: "UTC+12" },
  { value: "Pacific/Marquesas", label: "Marquesas Time", offset: "UTC-9:30" },
  { value: "Pacific/Midway", label: "Samoa Time", offset: "UTC-11" },
  { value: "Pacific/Nauru", label: "Nauru Time", offset: "UTC+12" },
  { value: "Pacific/Niue", label: "Niue Time", offset: "UTC-11" },
  { value: "Pacific/Norfolk", label: "Norfolk Island Time", offset: "UTC+11" },
  { value: "Pacific/Noumea", label: "New Caledonia Time", offset: "UTC+11" },
  { value: "Pacific/Pago_Pago", label: "Samoa Time", offset: "UTC-11" },
  { value: "Pacific/Palau", label: "Palau Time", offset: "UTC+9" },
  { value: "Pacific/Pitcairn", label: "Pitcairn Time", offset: "UTC-8" },
  { value: "Pacific/Pohnpei", label: "Pohnpei Time", offset: "UTC+11" },
  {
    value: "Pacific/Port_Moresby",
    label: "Papua New Guinea Time",
    offset: "UTC+10",
  },
  { value: "Pacific/Rarotonga", label: "Cook Islands Time", offset: "UTC-10" },
  { value: "Pacific/Saipan", label: "Chamorro Time", offset: "UTC+10" },
  { value: "Pacific/Tahiti", label: "Tahiti Time", offset: "UTC-10" },
  { value: "Pacific/Tarawa", label: "Gilbert Islands Time", offset: "UTC+12" },
  { value: "Pacific/Tongatapu", label: "Tonga Time", offset: "UTC+13" },
  { value: "Pacific/Wake", label: "Wake Island Time", offset: "UTC+12" },
  { value: "Pacific/Wallis", label: "Wallis & Futuna Time", offset: "UTC+12" },

  // UTC
  { value: "UTC", label: "Coordinated Universal Time", offset: "UTC+0" },
];

// Helper function to get timezone by value
export const getTimezoneByValue = (value: string): Timezone | undefined => {
  return TIMEZONES.find((tz) => tz.value === value);
};

// Helper function to get US timezones only
export const getUSTimezones = (): Timezone[] => {
  return TIMEZONES.filter(
    (tz) =>
      tz.value.startsWith("America/") || tz.value.startsWith("Pacific/Honolulu")
  );
};

// Helper functions for timezone management
export const getTimezonesByRegion = () => {
  const regions: Record<string, Timezone[]> = {};

  TIMEZONES.forEach((tz) => {
    const region = tz.value.split("/")[0];
    if (!regions[region]) {
      regions[region] = [];
    }
    regions[region].push(tz);
  });

  return regions;
};

export const searchTimezones = (query: string): Timezone[] => {
  const lowerQuery = query.toLowerCase();
  return TIMEZONES.filter(
    (tz) =>
      tz.label.toLowerCase().includes(lowerQuery) ||
      tz.value.toLowerCase().includes(lowerQuery) ||
      tz.offset.toLowerCase().includes(lowerQuery)
  );
};

export const getPopularTimezones = (): Timezone[] => {
  const popularValues = [
    // UTC offsets (no duplicates)
    "America/New_York", // UTC-5/-4 (EST/EDT)
    "America/Chicago", // UTC-6/-5 (CST/CDT)
    "America/Denver", // UTC-7/-6 (MST/MDT)
    "America/Los_Angeles", // UTC-8/-7 (PST/PDT)
    "America/Anchorage", // UTC-9/-8 (AKST/AKDT)
    "Pacific/Honolulu", // UTC-10 (HST)
    "America/Sao_Paulo", // UTC-3 (BRT)
    "America/St_Johns", // UTC-3:30/-2:30 (NST/NDT - Newfoundland)
    "America/Santiago", // UTC-4/-3 (CLT/CLST)

    "Europe/London", // UTC+0/+1 (GMT/BST)
    "Europe/Paris", // UTC+1/+2 (CET/CEST)
    "Europe/Athens", // UTC+2/+3 (EET/EEST)
    "Europe/Moscow", // UTC+3 (MSK)

    "Asia/Dubai", // UTC+4 (GST)
    "Asia/Karachi", // UTC+5 (PKT)
    "Asia/Kolkata", // UTC+5:30 (IST)
    "Asia/Kathmandu", // UTC+5:45 (NPT)
    "Asia/Dhaka", // UTC+6 (BST)
    "Asia/Yangon", // UTC+6:30 (MMT)
    "Asia/Bangkok", // UTC+7 (ICT)
    "Asia/Shanghai", // UTC+8 (CST)
    "Asia/Tokyo", // UTC+9 (JST)
    "Australia/Adelaide", // UTC+9:30/+10:30 (ACST/ACDT)
    "Australia/Sydney", // UTC+10/+11 (AEST/AEDT)
    "Pacific/Norfolk", // UTC+11/+12 (NFT)
    "Pacific/Auckland", // UTC+12/+13 (NZST/NZDT)

    "Africa/Lagos", // UTC+1 (WAT)
    "Africa/Cairo", // UTC+2 (EET)

    "UTC", // UTC+0 (Universal Time)
  ];

  return TIMEZONES.filter((tz) => popularValues.includes(tz.value));
};

// Helper function to format timezone for display
export const formatTimezone = (timezone: Timezone): string => {
  return `${timezone.value} - ${timezone.label} (${timezone.offset})`;
};
