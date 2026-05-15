import type { PvDto, TrackerConfig } from "@en/common/tracker";
import { report } from "@/report";
const reportView = (visitorId: string, config: TrackerConfig) => {
  let url = config.baseUrl + config.pv.api;
  const isHash = location.hash.startsWith("#/"); //#/开头 说明是hash模式
  const body: PvDto = {
    visitorId,
    url: window.location.protocol + "//" + window.location.host,
    referrer: document.referrer,
    path: isHash ? location.hash.replace("#", "") : location.pathname + location.search,
  };
  report(url, body);
};

export const reportPv = (visitorId: string, config: TrackerConfig) => {
  reportView(visitorId, config); //初始化上报
  //路由的模式 hash history
  window.addEventListener("hashchange", (e) => {
    reportView(visitorId, config);
  });
  //popstate 前进和后退
  //router.push router.replace
  window.addEventListener("popstate", (e) => {
    reportView(visitorId, config);
  });
  const originalPushState = history.pushState; //获取原始的pushState方法
  history.pushState = function (...args) {
    try {
      originalPushState.apply(this, args); // 先干正事
    } finally {
      reportView(visitorId, config); // 无论成功与否，都尝试上报
    }
  };
  const originalReplaceState = history.replaceState; //获取原始的replaceState方法
  history.replaceState = function (...args) {
    try {
      originalReplaceState.apply(this, args); // 先干正事
    } finally {
      reportView(visitorId, config); // 无论成功与否，都尝试上报
    }
  };
};
