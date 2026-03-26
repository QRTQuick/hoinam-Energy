(function () {
  const origin = window.location.origin;

  window.HOINAM_CONFIG = {
    apiBaseUrl: `${origin}/api`,
    enablePhoneAuth: true,
    firebase: {
      apiKey: "AIzaSyBMUFz5qgyl_RKK5IuPvB-9infl_FoM3_8",
      authDomain: "hoinam-energy-workspace.firebaseapp.com",
      projectId: "hoinam-energy-workspace",
      appId: "1:285359013809:web:b6036979397c4ced0ec790",
      messagingSenderId: "285359013809",
      storageBucket: "hoinam-energy-workspace.firebasestorage.app",
      measurementId: "G-L9P5WWZPYF"
    },
    company: {
      name: "Hoinam Energy",
      tagline: "Solar power installation and EcoFlow energy systems",
      offices: [
        {
          title: "Corporate Office",
          address: "235 Umuocham Road, off Tonimas Junction by Enugu-PHC Express, Osisioma, Aba, Abia."
        },
        {
          title: "PHC Office",
          address: "1 Okechukwu Chukwu Street, off Ogbatai, Woji, Port Harcourt, Rivers."
        },
        {
          title: "Lagos Office",
          address: "9 Ogundoju Street, Lagos"
        }
      ]
    }
  };
})();
