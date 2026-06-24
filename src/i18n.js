// src/i18n.js
// 整个项目只需要这一份配置，初始化一次即可，跟改造多少组件无关
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 把每个组件/页面对应的翻译文件按命名空间引入
// 项目越大，这里的import会越多，建议后期换成懒加载（i18next-http-backend）
import inspectorEn from './locales/en/inspector.json';
import inspectorZh from './locales/zh/inspector.json';
import appEn from './locales/en/app.json';
import appZh from './locales/zh/app.json';
import fieldCardEn from './locales/en/fieldCard.json';
import fieldCardZh from './locales/zh/fieldCard.json';
import particleCardEn from './locales/en/particleCard.json';
import particleCardZh from './locales/zh/particleCard.json';
import commonEn from './locales/en/common.json'; // common是跨组件共享的词条（如Del/Show）
import commonZh from './locales/zh/common.json';

i18n
  .use(LanguageDetector) // 自动检测用户语言：localStorage > 浏览器设置 > html标签
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        inspector: inspectorEn,
        app: appEn,
        fieldCard: fieldCardEn,
        particleCard: particleCardEn,
        common: commonEn,
        // home: homeEn,
      },
      zh: {
        inspector: inspectorZh,
        app: appZh,
        fieldCard: fieldCardZh,
        particleCard: particleCardZh,
        common: commonZh,
        // home: homeZh,
      },
    },
    // 显式列出所有命名空间，新增组件时如果忘记在resources里注册，
    // 这里也能提醒自己同步加一下，避免遗漏
    ns: ['inspector', 'app', 'fieldCard', 'particleCard', 'common'],
    fallbackLng: 'en', // 找不到对应翻译时的兜底语言
    interpolation: {
      escapeValue: false, // React本身就会转义，这里关掉避免重复转义
    },
    detection: {
      order: ['localStorage', 'navigator'], // 优先读取上次保存的选择
      caches: ['localStorage'], // 切换语言后自动存入localStorage，刷新不丢失
    },
  });

export default i18n;

// ============================================
// src/App.jsx 中只需要这样引入一次（放在最顶层）：
// import './i18n';
// ============================================

// ============================================
// 语言切换组件示例，可以放在页面任意位置（如顶部导航栏）：
// ============================================
/*
import { useTranslation } from 'react-i18next';
import { useEffect } from 'react';

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  // 切换语言时同步更新 <html lang="">，对SEO和无障碍访问很重要
  useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      <button onClick={() => i18n.changeLanguage('zh')}>中文</button>
      <button onClick={() => i18n.changeLanguage('en')}>EN</button>
    </div>
  );
}
*/