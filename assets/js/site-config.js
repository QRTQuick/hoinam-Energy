(function () {
  const origin = window.location.origin;
  const hostname = window.location.hostname;
  const useCustomAuthDomain =
    hostname.endsWith(".vercel.app") || hostname === "hoinam-energy.vercel.app" || hostname === "hoinamenergy.com";
  const authDomain = useCustomAuthDomain ? hostname : "hoinam-energy-workspace.firebaseapp.com";

  window.HOINAM_CONFIG = {
    apiBaseUrl: `${origin}/api`,
    enablePhoneAuth: true,
    firebase: {
      apiKey: "AIzaSyBMUFz5qgyl_RKK5IuPvB-9infl_FoM3_8",
      authDomain,
      projectId: "hoinam-energy-workspace",
      appId: "1:285359013809:web:b6036979397c4ced0ec790",
      messagingSenderId: "285359013809",
      storageBucket: "hoinam-energy-workspace.firebasestorage.app",
      measurementId: "G-L9P5WWZPYF"
    },
    company: {
      name: "Hoinam Energy",
      tagline: "Solar installation, backup products, and energy support",
      about:
        "Hoinam Energy supplies backup systems, portable power stations, solar panels, and practical service support for homes, offices, shops, and growing businesses across Nigeria. We help customers move from product selection to delivery planning, installation coordination, and dependable follow-up.",
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
          question: "What kind of products does Hoinam Energy sell?",
          answer: "Hoinam Energy supplies portable stations, larger backup systems, foldable solar panels, and related power accessories through the online catalog."
        },
        {
          question: "Can I book installation after ordering a product?",
          answer: "Yes. Customers can place an order and also submit an installation request for load review, site planning, setup coordination, and follow-up."
        },
        {
          question: "Do you support homes, offices, and commercial sites?",
          answer: "Yes. Hoinam Energy supports residential, office, retail, and business backup power projects with product guidance and installation coordination."
        },
        {
          question: "What support do you provide during service?",
          answer: "Hoinam Energy helps with product selection, delivery planning, installation booking, setup guidance, and post-purchase follow-up so customers are not left alone after buying."
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
