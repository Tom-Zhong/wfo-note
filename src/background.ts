import browser from "webextension-polyfill";
import { Formatter } from "./utils/Formatter";

const isDev = process.env.NODE_ENV === 'development';

// 监听 popup 发送的消息，立即弹通知
browser.runtime.onMessage.addListener(async (message) => {
  if (message && message.type === 'storageMode') {
    // 处理 storageMode 消息
    const mode = message.payload;
    if (!mode) {
      // console.error('Invalid mode data received from popup:', mode);
      return;
    }
    // 存储或处理 mode 数据
    // console.log('Received alert mode from popup:', mode);
    await browser.storage.local.set({ alertDay: '' }) // 重置 alertDay，确保模式切换后当天仍可提醒
    await browser.storage.local.set({ alertMode: mode })
  }

  if (message && message.type === 'storageWorkdays') {
    // 处理 storageWorkdays 消息
    const workdays = message.payload;
    if (!workdays) {
      // console.error('Invalid workdays data received from popup:', workdays);
      return;
    }
    // 存储或处理 workdays 数据
    // console.log('Received workdays from popup:', workdays);
    await browser.storage.local.set({ workdays })
  }
});

browser.runtime.onInstalled.addListener(() => {
  // browser.alarms.create('minuteReminder', { periodInMinutes: 1 });
  browser.alarms.create('checkDates', { periodInMinutes: isDev ? 1 : 180 }); // 每分钟检查一次日期
});

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkDates') {
    const result = await browser.storage.local.get('workdays');
    const alertMode = (await browser.storage.local.get('alertMode')).alertMode;
    const workdays: Record<string, string[]> = result.workdays || {};
    // console.log('Checking workdays:', workdays);
    const today = new Date(); // 'YYYY/MM/DD'
    const yearMonth = today.toISOString().slice(0, 7); // 'YYYY-MM'
    const getCurrentMonthWorkdays = workdays[yearMonth] || [];
    // console.log('Current month workdays:', getCurrentMonthWorkdays);

    const alertDayResult = await browser.storage.local.get('alertDay');
    const alertDay: string = alertDayResult.alertDay || '';
    // console.log('Last alert day:', alertDay);

    if (alertDay === Formatter.formatDateToString(today) && !isDev) {
      // console.log('Already alerted for today:', Formatter.formatDateToString(today));
      return;
    }

    if (alertMode === 'silent') {
      // 静音模式不提醒
      // console.log('Alert mode is silent, no notification will be shown.');
      return;
    }

    // flexible 模式下，每个工作日都提醒
    if (
      (getCurrentMonthWorkdays.includes(Formatter.formatDateToString(today)) && alertMode === 'strict')
      || alertMode === 'flexible'
    ) {
      // 创建带按钮的通知
      // @ts-ignore
      self.registration.showNotification('WFO提醒', {
        title: 'WFO提醒',
        body: `今天（${Formatter.formatDateToString(today)}）您有计划去公司办公！ 你今天有WFO吗？`,
        icon: '/icon/48.png',
        actions: [
          { action: 'confirmWFO', title: '有' },
          { action: 'ignore', title: '忽略' }
        ],
        requireInteraction: true
      });

      // browser.notifications.create('wfo-action', {
      //   type: 'basic',
      //   iconUrl: '/icon/48.png',
      //   title: 'WFO提醒',
      //   message: '今天有计划去公司办公！',
      //   // @ts-ignore
      //   actions: [
      //     { title: '打开日历' },
      //     { title: '忽略' }
      //   ],
      //   // @ts-ignore
      //   requireInteraction: true
      // });
    }
  }
});

// 监听通知关闭
browser.notifications.onClosed.addListener(async (id) => {
  // console.log('Notification closed:', id);
  await browser.storage.local.set({ alertDay: Formatter.formatDateToString(new Date()) });
});

// 关闭通知
browser.notifications.onClicked.addListener((id) => {
  console.log('Notification clicked:', id);
  browser.notifications.clear(id);
});

browser.notifications.onButtonClicked.addListener((id, buttonIndex) => {
  console.log('Notification button clicked:', id, buttonIndex);
  browser.notifications.clear(id);
});

self.addEventListener('notificationclick', async (event) => {
  console.log('Service Worker Notification clicked:', event);
  // @ts-ignore
  const action = event.action;
  if (action === 'ignore') {
    console.log('User chose to ignore the notification.');
  } else if (action === 'confirmWFO') {
    // 确认WFO操作
    console.log('User confirmed they have WFO today.');
    // 获取当月用户点击确认WFO的日期列表
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    console.log('Current month for WFO storage:', currentMonth);

    // 获取已有的WFO日期列表
    const existingWFOdates = (await browser.storage.local.get(`userWfoDates_${currentMonth}`))[`userWfoDates_${currentMonth}`] || [];
    console.log('Existing WFO dates for current month:', existingWFOdates);

    if (existingWFOdates.includes(Formatter.formatDateToString(new Date()))) {
      console.log('WFO date for today already recorded.');
      // @ts-ignore
      event.notification.close();
      return;
    } else {
      existingWFOdates.push(Formatter.formatDateToString(new Date()));
      await browser.storage.local.set({ [`wfoDates_${currentMonth}`]: existingWFOdates });
      console.log('Updated WFO dates for current month:', existingWFOdates);
    }
  }
  // @ts-ignore
  event.notification.close();
});

console.log("[background.ts] Background script loaded.");