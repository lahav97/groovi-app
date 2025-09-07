export const ISRAEL_CITIES = [
    // Tier 1 - Major Population Centers
    'Tel Aviv-Yafo',
    'Jerusalem',
    'Haifa',

    // Tier 2 - Large Cities
    'Rishon LeZion',
    'Petah Tikva',
    'Ashdod',
    'Netanya',
    'Beer Sheva',
    'Bnei Brak',
    'Holon',
    'Ramat Gan',

    // Tier 3 - Important Regional Centers
    'Ashkelon',
    'Rehovot',
    'Bat Yam',
    'Beit Shemesh',
    'Kfar Saba',
    'Herzliya',
    'Hadera',
    'Ra\'anana',
    'Modi\'in-Maccabim-Re\'ut',
    'Lod',
    'Ramla',
    'Acre', // Akko
    'Tiberias',
    'Eilat',
    'Nazareth',

    // Tier 4 - Smaller Cities & Regional Coverage
    'Carmiel',
    'Dimona',
    'Kiryat Gat',
    'Safed', // Tzfat
    'Kiryat Ata',
    'Kiryat Bialik',
    'Kiryat Yam',
    'Rosh HaAyin',
    'Yavne',
    'Givat Shmuel',
    'Kiryat Ono',
    'Or Yehuda'
];

// Regional groupings for advanced filtering
export const CITIES_BY_REGION = {
    center: [
        'Tel Aviv-Yafo',
        'Rishon LeZion',
        'Petah Tikva',
        'Bnei Brak',
        'Holon',
        'Ramat Gan',
        'Rehovot',
        'Bat Yam',
        'Kfar Saba',
        'Herzliya',
        'Ra\'anana',
        'Modi\'in-Maccabim-Re\'ut',
        'Lod',
        'Ramla',
        'Rosh HaAyin',
        'Yavne',
        'Givat Shmuel',
        'Kiryat Ono',
        'Or Yehuda'
    ],
    north: [
        'Haifa',
        'Netanya',
        'Hadera',
        'Acre',
        'Tiberias',
        'Nazareth',
        'Carmiel',
        'Safed',
        'Kiryat Ata',
        'Kiryat Bialik',
        'Kiryat Yam'
    ],
    south: [
        'Beer Sheva',
        'Ashdod',
        'Ashkelon',
        'Eilat',
        'Dimona',
        'Kiryat Gat'
    ],
    jerusalem: [
        'Jerusalem',
        'Beit Shemesh'
    ]
};

// Major cities for quick access
export const MAJOR_CITIES = [
    'Tel Aviv-Yafo',
    'Jerusalem',
    'Haifa',
    'Rishon LeZion',
    'Petah Tikva',
    'Ashdod',
    'Netanya',
    'Beer Sheva',
    'Herzliya',
    'Ra\'anana',
    'Rehovot'
];

// University cities
export const UNIVERSITY_CITIES = [
    'Tel Aviv-Yafo',
    'Jerusalem',
    'Haifa',
    'Beer Sheva',
    'Rehovot',
    'Ra\'anana'
];

// Helper functions
export const getCitiesByRegion = (region) => {
    return CITIES_BY_REGION[region.toLowerCase()] || [];
};

export const findCityByName = (searchTerm) => {
    const term = searchTerm.toLowerCase();
    return ISRAEL_CITIES.filter(city =>
        city.toLowerCase().includes(term)
    );
};

export const isMajorCity = (cityName) => {
    return MAJOR_CITIES.includes(cityName);
};

export const isUniversityCity = (cityName) => {
    return UNIVERSITY_CITIES.includes(cityName);
};

export default ISRAEL_CITIES;