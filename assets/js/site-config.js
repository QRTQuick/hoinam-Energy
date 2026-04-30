(function () {
  const origin = window.location.origin;
  const hostname = window.location.hostname;
  const productionAuthDomain = "www.hoinamenergy.com";
  const defaultAuthDomain = "hoinam-energy-workspace.firebaseapp.com";
  // Keep redirect sign-in on the production site domain for same-site auth
  // flows, while falling back to the Firebase-managed domain locally.
  const authDomain = /(^|\.)hoinamenergy\.com$/i.test(hostname)
    ? productionAuthDomain
    : defaultAuthDomain;

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
        "Hoinam Energy supplies solar panels, backup power systems, portable stations, and installation services for homes, offices, shops, and businesses across Nigeria. We work with multiple brands and help customers from product selection through to installation and after-service support.",
      email: "hoinamenergy@gmail.com",
      offices: [
        {
          title: "Aba Office",
          address: "235 Umuocham Road, off Tonimas Junction by Enugu-PHC Express, Osisioma, Aba, Abia."
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
          label: "LinkedIn",
          icon: "fa-brands fa-linkedin-in",
          href: "https://www.linkedin.com/company/hoinam-energy/about/?viewAsMember=true"
        },
        {
          label: "Instagram",
          icon: "fa-brands fa-instagram",
          href: "https://www.instagram.com/hoinamenergy/"
        },
        {
          label: "Facebook",
          icon: "fa-brands fa-facebook-f",
          href: "https://www.facebook.com/profile.php?id=61577479876089"
        },
        {
          label: "X (Twitter)",
          icon: "fa-brands fa-x-twitter",
          href: "https://x.com/HoinamEnergy"
        }
      ]
    }
  };
})();
