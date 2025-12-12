import browser from "webextension-polyfill";
import { Formatter } from "./utils/Formatter";

const isDev = process.env.NODE_ENV === 'development';

//  创建并且按指定秒数消失notification
function createAutoClosingNotification(id: string, options: any, timeoutMs: number = 60000) {
  // @ts-ignore
  self.registration.showNotification(options.title, {
    ...options,
    tag: id // Use tag to identify the notification
  });
  
  // Automatically close the notification after timeoutMs milliseconds
  setTimeout(() => {
    // @ts-ignore
    self.registration.getNotifications({tag: id}).then(notifications => {
      notifications.forEach((notification: any) => {
        notification.close();
      });
    });
  }, timeoutMs);
}

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

  if (message && message.type === 'storageCurrentUserWorkdays') {
    // 处理 storageCurrentUserWorkdays 消息
    const currentUserWorkdays = message.payload;
    if (!currentUserWorkdays) {
      // console.error('Invalid currentUserWorkdays data received from popup:', currentUserWorkdays);
      return;
    }
    // 存储或处理 currentUserWorkdays 数据
    // console.log('Received currentUserWorkdays from popup:', currentUserWorkdays);
    await browser.storage.local.set(currentUserWorkdays)
  }
});

browser.runtime.onInstalled.addListener(async() => {
  // browser.alarms.create('minuteReminder', { periodInMinutes: 1 });
  browser.alarms.create('checkDates', { periodInMinutes: isDev ? 1 : 180 }); // 每分钟检查一次日期
  console.log('[background.ts] period checked is registered, periodInMinutes: ', isDev ? 1 : 180);

  // 初始化存储
  await browser.storage.local.set({ alertDay: '' }); // 重置 alertDay，确保模式切换后当天仍可提醒
  await browser.storage.local.set({ alertMode: 'silent' });
  await browser.storage.local.set({ workdays: {} });
});

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkDates') {
    // console.log('[background.ts] period checked is triggered');
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

    const modeText = alertMode === 'strict' ? 'WFO日提醒模式' : '灵活模式';

    // flexible 模式下，每个工作日都提醒
    if (
      (getCurrentMonthWorkdays.includes(Formatter.formatDateToString(today)) && alertMode === 'strict')
      || alertMode === 'flexible'
    ) {
      // 创建带按钮的通知
      // @ts-ignore
      // self.registration.showNotification('WFO提醒', {
      //   title: 'WFO提醒',
      //   body: `今天（${Formatter.formatDateToString(today)}）您有计划去公司办公！ 你今天有WFO吗？`,
      //   icon: '/icon/48.png',
      //   actions: [
      //     { action: 'confirmWFO', title: '有' },
      //     { action: 'notWFOThisWeek', title: '本周不去公司' }
      //   ],
      //   requireInteraction: true,
      //   tag: 'wfo-action',
      // });

      const notificationId = 'wfo-reminder-' + Date.now();
      const notificationOptions = {
        title: 'WFO提醒',
        body: `[${modeText}] 今天（${Formatter.formatDateToString(today)} 您有计划去公司办公！ 你今天有WFO吗？`,
        icon: '/icon/48.png',
        actions: [
          { action: 'confirmWFO', title: '有' },
          { action: 'notWFOThisWeek', title: '本周不去公司' }
        ],
        requireInteraction: true
      };

      createAutoClosingNotification(notificationId, notificationOptions, 10000);

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
// browser.notifications.onClicked.addListener((id) => {
//   // console.log('Notification clicked:', id);
//   browser.notifications.clear(id);
// });

// browser.notifications.onButtonClicked.addListener((id, buttonIndex) => {
//   // console.log('Notification button clicked:', id, buttonIndex);
//   browser.notifications.clear(id);
// });

self.addEventListener('notificationclick', async (event) => {
  // console.log('Service Worker Notification clicked:', event);
  // @ts-ignore
  const action = event.action;
  if (action === 'ignore') {
    // console.log('User chose to ignore the notification.');
  } else if (action === 'confirmWFO') {
    // 确认WFO操作
    // console.log('User confirmed they have WFO today.');
    // 获取当月用户点击确认WFO的日期列表
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
    // console.log('Current month for WFO storage:', currentMonth);

    // 获取已有的WFO日期列表
    const existingWFOdates = (await browser.storage.local.get(`userWfoDates_${currentMonth}`))[`userWfoDates_${currentMonth}`] || [];
    // console.log('Existing WFO dates for current month:', existingWFOdates);

    if (existingWFOdates.includes(Formatter.formatDateToString(new Date()))) {
      // console.log('WFO date for today already recorded.');
      // @ts-ignore
      event.notification.close();
      return;
    } else {
      existingWFOdates.push(Formatter.formatDateToString(new Date()));
      await browser.storage.local.set({ [`wfoDates_${currentMonth}`]: existingWFOdates });
      // console.log('Updated WFO dates for current month:', existingWFOdates);
    }

    // 获取当月全月工作日减去用户定义的休假日数
    const currentUserWorkdays = (await browser.storage.local.get(`currentUserWorkdays`))[`currentUserWorkdays`] || 0;

    // 给出建议，用户如果确认的WFO日期达到或超过当月工作日数，则提示用户
    if (existingWFOdates.length / currentUserWorkdays > 0.4) {
      // @ts-ignore
      self.registration.showNotification('WFO提醒', {
        title: 'WFO提醒',
        body: `按照您当前已经确认的工作日天数，您已经满足40%的WFO需求啦！`,
        icon: '/icon/48.png',
        actions: [
          { action: 'ignore', title: '忽略' }
        ],
        requireInteraction: true
      });
    } else {
       // @ts-ignore
       self.registration.showNotification('WFO提醒', {
        title: 'WFO提醒',
        body: `按照您当前已经确认的工作日天数，您仍未满足40%的WFO需求，你可能还需要去公司${String(Math.floor((currentUserWorkdays) * 0.4) - existingWFOdates.length)}天WFO！`,
        icon: '/icon/48.png',
        actions: [
          { action: 'ignore', title: '忽略' }
        ],
        requireInteraction: true
      });
    }
    // @ts-ignore
    event.notification.close();
  } else if (action === 'notWFOThisWeek') {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const existingWFOdates = (await browser.storage.local.get(`userWfoDates_${currentMonth}`))[`userWfoDates_${currentMonth}`] || [];
    // console.log('Existing WFO dates for current month:', existingWFOdates);

    // 获取当月全月工作日减去用户定义的休假日数
    const currentUserWorkdays = (await browser.storage.local.get(`currentUserWorkdays`))[`currentUserWorkdays`] || 0;
    
    // 计算本周不去公司的话，接下来每周最少去公司几天
    // 接下来一周不去公司
    // 获取今天在本月第几周
    const weekNumber = Formatter.getWeekNumber(new Date());

    const weeksInMonth = Formatter.getWeeksInMonth(new Date());

    const perWorkdaysPlusWeek = Math.floor(currentUserWorkdays * 0.4) - existingWFOdates.length;

    // 直接计算剩余几周，然后计算要达到40%的WFO， 剩下几周最少每周去公司几天
    const remainingWeeks = weeksInMonth - weekNumber;
    // console.log('Remaining weeks:', remainingWeeks);

    const perWorkdays = Math.floor(perWorkdaysPlusWeek / remainingWeeks);

    // console.log('Per workdays:', perWorkdays);
    // @ts-ignore
    self.registration.showNotification('WFO提醒', {
      title: 'WFO提醒',
      body: `按照您当前已经确认工作日数，您接下来仍然需要每周去公司${perWorkdays} 天WFO！`,
      icon: '/icon/48.png',
      actions: [
        { action: 'ignore', title: '知道了' }
      ],
      requireInteraction: true
    });
  }
});

console.log("[background.ts] Background script loaded.");