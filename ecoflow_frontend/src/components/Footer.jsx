import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-deepForest text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-12 md:grid-cols-3">
        <div>
          <h3 className="font-heading text-lg font-semibold">Hoinam Energy</h3>
          <p className="mt-3 text-sm text-ecoLightGreen">
            Redefining energy infrastructure with EcoFlow solar solutions and expert installations.
          </p>
        </div>
        <div>
          <h4 className="font-semibold text-sunLightOrange">Locations</h4>
          <ul className="mt-3 space-y-2 text-sm">
            <li>Corporate Office: 235 Umuocham Road, off Tonimas Junction by Enugu-PHC Express, Osisioma, Aba, Abia.</li>
            <li>PHC Office: 1 Okechukwu Chukwu Street, off Ogbatai, Woji, Port Harcourt, Rivers.</li>
            <li>Lagos Office: 9 Ogundoju Street, Lagos.</li>
          </ul>
        </div>
        <div>
          <h4 className="font-semibold text-sunLightOrange">Support</h4>
          <p className="mt-3 text-sm text-ecoLightGreen">
            Need help choosing your EcoFlow system? Reach our team for product guidance, delivery, and installation.
          </p>
          <p className="mt-4 text-sm">hello@hoinamenergy.com</p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-ecoLightGreen">
        © {new Date().getFullYear()} Hoinam Energy. Built for clean power across Nigeria.
      </div>
    </footer>
  );
}
