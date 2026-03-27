(function () {
  const origin = window.location.origin;
  const hostname = window.location.hostname;
  const isLocalHost = ["localhost", "127.0.0.1"].includes(hostname);
  const firebaseAuthDomain = isLocalHost ? "hoinam-energy-workspace.firebaseapp.com" : window.location.host;

  window.HOINAM_CONFIG = {
    apiBaseUrl: `${origin}/api`,
    enablePhoneAuth: true,
    firebase: {
      apiKey: "AIzaSyBMUFz5qgyl_RKK5IuPvB-9infl_FoM3_8",
      authDomain: firebaseAuthDomain,
      projectId: "hoinam-energy-workspace",
      appId: "1:285359013809:web:b6036979397c4ced0ec790",
      messagingSenderId: "285359013809",
      storageBucket: "hoinam-energy-workspace.firebasestorage.app",
      measurementId: "G-L9P5WWZPYF"
    },
    company: {
      name: "Hoinam Energy",
      tagline: "Solar power installation and EcoFlow energy systems",
      about:
        "Hoinam Energy combines EcoFlow product sales with solar power planning and installation support for homes, offices, retail operations, and growing businesses that need dependable backup energy in Nigeria.",
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
      ],
      faq: [
        {
          question: "Do you sell EcoFlow products directly?",
          answer: "Yes. Hoinam Energy sells EcoFlow backup systems, portable power stations, and foldable solar panels through the online catalog."
        },
        {
          question: "Can I book installation after ordering a product?",
          answer: "Yes. Customers can place an order and also submit an installation request for site planning, setup, and follow-up."
        },
        {
          question: "Do you support homes, offices, and commercial sites?",
          answer: "Yes. The current product and installation flow is structured for residential, office, and business backup power projects."
        },
        {
          question: "How are payments confirmed?",
          answer: "Payments are processed through Paystack before order confirmation, and the backend verifies the transaction reference before creating the order."
        }
      ],
      socials: [
        {
          label: "Facebook",
          icon: "fa-brands fa-facebook-f",
          href: ""
        },
        {
          label: "Instagram",
          icon: "fa-brands fa-instagram",
          href: ""
        },
        {
          label: "LinkedIn",
          icon: "fa-brands fa-linkedin-in",
          href: ""
        },
        {
          label: "WhatsApp",
          icon: "fa-brands fa-whatsapp",
          href: ""
        }
      ]
    }
  };
})();
