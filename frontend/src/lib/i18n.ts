import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "welcome": "Welcome to Store App",
      "dashboard": "Dashboard",
      "inventory": "Inventory",
      "settings": "Settings"
    }
  },
  es: {
    translation: {
      "welcome": "Bienvenido a Store App",
      "dashboard": "Tablero",
      "inventory": "Inventario",
      "settings": "Configuraciones"
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: "en", // default language
    fallbackLng: "en",

    interpolation: {
      escapeValue: false // React already escapes by default
    }
  });

export default i18n;
