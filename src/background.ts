import browser, {notifications} from "webextension-polyfill";
import { Formatter } from "./utils/Formatter";
import { isWeekend } from "date-fns";

const isDev = process.env.NODE_ENV === 'development';

async function setCheckToday () {
  await browser.storage.local.set({ alertDay: Formatter.formatDateToString(new Date()) });
}

//  创建并且按指定秒数消失notification
function createAutoClosingNotification(id: string, options: any, timeoutMs: number = 60000) {
  // @ts-ignore

    self.registration.getNotifications({tag: id}).then(notifications => {
      var ifExistNoti = false
      notifications.forEach((notification: any) => {
        if (notification.tag === id) {
          ifExistNoti = true
        }
      });
      if (ifExistNoti) {
        console.log(`${id} notification exist!`);
        return;
      }
      console.log('show notification');
      self.registration.showNotification(options.title, {
        ...options,
        tag: id // Use tag to identify the notification
      });
    });

  
  // Automatically close the notification after timeoutMs milliseconds
  // setTimeout(() => {
  //   // @ts-ignore
  //   self.registration.getNotifications({tag: id}).then(notifications => {
  //     notifications.forEach((notification: any) => {
  //       notification.close();
  //     });
  //   });
  // }, timeoutMs);
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

  if (message && message.type === 'remindBefore1day') {
    if (message.payload) {
      // console.log('Received remindBefore1day from popup:', message.payload);
      const { remindBefore1day } = message.payload;
      console.log('Received remindBefore1day from popup:', remindBefore1day);
      await browser.storage.local.set({ remindBefore1day });
    }
  }

  if (message && message.type === 'wfoRatio') {
    if (message.payload) {
      // console.log('Received wfoRatio from popup:', message.payload);
      const { wfoRatio } = message.payload;
      console.log('Received wfoRatio from popup:', wfoRatio);
      await browser.storage.local.set({ wfoRatio });
    }
  }

  // 页面从service worker中获取用户手动点击确认的WFO day
  if (message && message.type === 'userWfoDates') {
    const payload = message.payload
    const year = new Date(payload).getFullYear();
    const month = (new Date(payload).getMonth() + 1).toString().padStart(2, '0');
    console.log('year-month', year, month)
    // const currentMonth = new Date(payload).toISOString().slice(0, 7);
    const currentMonth = `${year}-${month}`;
    const userWfoDates: any = (await browser.storage.local.get(`userWfoDates_${currentMonth}`))[`userWfoDates_${currentMonth}`];

    if (userWfoDates) {
      // postMessage to popup.tsx
      await browser.runtime.sendMessage({ type: 'userWfoDates', payload: {
          [`userWfoDates_${currentMonth}`]: userWfoDates,
          currentMonth,
        }});
    } else {
      await browser.runtime.sendMessage({ type: 'userWfoDates', payload: null });
    }
  }
});

browser.runtime.onInstalled.addListener(async() => {
  browser.alarms.create('checkDates', { periodInMinutes: isDev ? 1 : 60 }); // 每一小时检查一次日期
  console.log('[background.ts] period checked is registered, periodInMinutes: ', isDev ? 1 : 60);

  // 初始化存储
  await browser.storage.local.set({ alertDay: '' }); // 重置 alertDay，确保模式切换后当天仍可提醒
  await browser.storage.local.set({ alertMode: 'flexible' });
  await browser.storage.local.set({ workdays: {} });
  await browser.storage.local.set({ wfoRatio: 40 });
});

async function checkIfNotShowThisWeek() {
  const weekNumber = Formatter.getWeekNumber(new Date());
  const notShowWeeks = (await browser.storage.local.get('notShowWeeks')).notShowWeeks

  console.log('notShowWeeks', notShowWeeks, 'weeksInMonth', weekNumber)
  if (notShowWeeks === weekNumber) {
    console.log('选择了本周不去公司，所以本周将不会再提醒了！');
    return true;
  }

  await browser.storage.local.set({ notShowWeeks: null });

  return false;
}

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkDates') {
    // console.log('[background.ts] period checked is triggered');
    const result = await browser.storage.local.get('workdays');
    const alertMode = (await browser.storage.local.get('alertMode')).alertMode;
    const workdays: Record<string, string[]> = result.workdays || {};
    console.log('Checking workdays:', workdays);
    const today = new Date(); // 'YYYY/MM/DD'
    const yearMonth = today.toISOString().slice(0, 7); // 'YYYY-MM'
    console.log('yeahMonth, ', yearMonth,  workdays, workdays[yearMonth]);
    const getCurrentMonthWorkdays = workdays[yearMonth] || [];
    console.log('Current month workdays:', getCurrentMonthWorkdays);

    const alertDayResult = await browser.storage.local.get('alertDay');
    const alertDay: string = alertDayResult.alertDay || '';
    console.log('Last alert day:', alertDay);

    if (await checkIfNotShowThisWeek()) {
      return;
    }

    if (alertDay === Formatter.formatDateToString(today)) {
      console.log('Already alerted for today:', Formatter.formatDateToString(today));
      return;
    }

    if (alertMode === 'silent') {
      // 静音模式不提醒
      console.log('Alert mode is silent, no notification will be shown.');
      return;
    }

    const modeText = alertMode === 'strict' ? 'WFO日提醒模式' : '灵活模式';

    // flexible 模式下，每个工作日都提醒
    if (
      (getCurrentMonthWorkdays.includes(Formatter.formatDateToString(today)) && alertMode === 'strict')
      || (alertMode === 'flexible' && (!isWeekend(today) || isDev))
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

      const currentHours = today.getHours();

      const notificationId = 'wfo-reminder-today';

      console.log('当前时间， currentHours:', currentHours);

      // 只在9:00 - 18:00提醒
      if (currentHours < 7 || currentHours > 18) {
        console.log('[background.ts] Notification不会展示，是因为当前时间不在9:00 - 18:00内， 即上班时间段内。');
        return;
      }

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

      // await browser.storage.local.set({ alertDay: Formatter.formatDateToString(new Date()) });

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

browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkDates') {
    // 获取是否要提前一日提醒用户WFO
    const remindBefore1day = (await browser.storage.local.get('remindBefore1day')).remindBefore1day;
    const remindBefore1dayTime = (await browser.storage.local.get('remindBefore1dayTime')).remindBefore1dayTime;
    // console.log('[background.ts] remindBefore1day:', remindBefore1day, remindBefore1dayTime);

    const result = await browser.storage.local.get('workdays');
    const workdays: Record<string, string[]> = result.workdays || {};
    // console.log('Checking workdays:', workdays);
    const today = new Date(); // 'YYYY/MM/DD'
    const yearMonth = today.toISOString().slice(0, 7); // 'YYYY-MM'
    const getCurrentMonthWorkdays = workdays[yearMonth] || [];
    // console.log('Current month workdays:', getCurrentMonthWorkdays);

    // 获取比今天晚一天的工作日
    const firstUpcomingWorkday = getCurrentMonthWorkdays.find(dateStr => {
      const workday = new Date(dateStr);
      return workday >= today && workday.toDateString() !== today.toDateString();
    });

    // console.log('First upcoming workday:', firstUpcomingWorkday);

    // 如果是true，那么将在下午五点左右提醒用户明日要WFO
    // 并且检查是否提醒过了
    if (remindBefore1day && (!remindBefore1dayTime || new Date(remindBefore1dayTime).getDate() !== today.getDate())) {
      if (today.getHours() >= 16) {
        // console.log('It is after 16pm, so we will remind you tomorrow.');
        // 创建带按钮的通知
        createAutoClosingNotification(
          'wfo-reminder-' + firstUpcomingWorkday,
          {
            title: 'WFO提醒',
            body: `[提前工作日提醒] 在 ${firstUpcomingWorkday}）您有计划去公司办公！请知晓`,
            icon: '/icon/48.png',
            actions: [
              { action: 'ignore', title: '知道啦！' },
            ]
          },
          10000
        );
        // 存储今日的提醒时间
        await browser.storage.local.set({ remindBefore1dayTime: today.getTime() });
      }
    }
  }
});

self.addEventListener('notificationclick', async (event) => {
  const wfoRatioOriginVal = (await browser.storage.local.get('wfoRatio')).wfoRatio;
  const wfoRatio = Number(wfoRatioOriginVal) / 100;
  // console.log('Service Worker Notification clicked:', event);
  // @ts-ignore
  const action = event.action;
  if (action === 'ignore') {
    // console.log('User chose to ignore the notification.');
  } else if (action === 'confirmWFO') {
    // 确认WFO操作
    // console.log('User confirmed they have WFO today.');
    // 获取当月用户点击确认WFO的日期列表
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const currentMonth = `${year}-${month}` // 'YYYY-MM'
    // console.log('Current month for WFO storage:', currentMonth);
    await setCheckToday();
    // 获取已有的WFO日期列表
    const existingWFOdates = (await browser.storage.local.get(`userWfoDates_${currentMonth}`))[`userWfoDates_${currentMonth}`] || [];
    // console.log('Existing WFO dates for current month:', existingWFOdates);

    if (!existingWFOdates.includes(Formatter.formatDateToString(new Date()))) {
      // console.log('WFO date for today already recorded.');
      existingWFOdates.push(Formatter.formatDateToString(new Date()));
    }

    await browser.storage.local.set({ [`userWfoDates_${currentMonth}`]: existingWFOdates });

    try {
      // postMessage to popup.tsx
      await browser.runtime.sendMessage({ type: 'userWfoDates', payload: {
          [`userWfoDates_${currentMonth}`]: existingWFOdates,
          currentMonth,
        }});
    } catch (e) {
      console.log(e)
    }

    // 获取当月全月工作日减去用户定义的休假日数
    const currentUserWorkdays = (await browser.storage.local.get(`currentUserWorkdays`))[`currentUserWorkdays`] || 0;

    // 给出建议，用户如果确认的WFO日期达到或超过当月工作日数，则提示用户
    if (existingWFOdates.length >= Math.ceil(currentUserWorkdays * wfoRatio) ) {
      // @ts-ignore
      self.registration.showNotification('WFO提醒', {
        title: 'WFO提醒',
        body: `您当前已确认${existingWFOdates.length}工作日天数，您已经满足${wfoRatioOriginVal}%的WFO需求啦！接下来无需再WFO了！`,
        icon: '/icon/48.png',
        actions: [
          { action: 'ignore', title: '知道啦！' }
        ],
        requireInteraction: true
      });
    } else {
       // @ts-ignore
       self.registration.showNotification('WFO提醒', {
        title: 'WFO提醒',
        body: `您当前已确认${existingWFOdates.length}工作日天数，但是您仍未满足${wfoRatioOriginVal}%的WFO需求，你可能还需要去公司${String(Math.ceil(currentUserWorkdays * wfoRatio) - existingWFOdates.length)}天WFO！`,
        icon: '/icon/48.png',
        actions: [
          { action: 'ignore', title: '知道啦！' }
        ],
        requireInteraction: true
      });
    }
    // @ts-ignore
    event.notification.close();
  } else if (action === 'notWFOThisWeek') {
    await setCheckToday();

    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const currentMonth = `${year}-${month}` // 'YYYY-MM'
    const existingWFOdates = (await browser.storage.local.get(`userWfoDates_${currentMonth}`))[`userWfoDates_${currentMonth}`] || [];
    // console.log('Existing WFO dates for current month:', existingWFOdates);

    // 获取当月全月工作日减去用户定义的休假日数
    const currentUserWorkdays = (await browser.storage.local.get(`currentUserWorkdays`))[`currentUserWorkdays`] || 0;

    // console.log('currentUserWorkdays', currentUserWorkdays, Math.ceil(currentUserWorkdays * wfoRatio));
    // console.log('wfoRatio', wfoRatio);
    // console.log('existingWFOdates', existingWFOdates.length);

    // 计算本周不去公司的话，接下来每周最少去公司几天
    // 接下来一周不去公司
    // 获取今天在本月第几周
    const weekNumber = Formatter.getWeekNumber(new Date());

    const weeksInMonth = Formatter.getWeeksInMonth(new Date());

    await browser.storage.local.set({ notShowWeeks: weekNumber });

    const perWorkdaysPlusWeek = Math.ceil(currentUserWorkdays * wfoRatio) - existingWFOdates.length;

    // 直接计算剩余几周，然后计算要达到wfoRatio的WFO， 剩下几周最少每周去公司几天
    const remainingWeeks = weeksInMonth - weekNumber;
    // console.log('Remaining weeks:', remainingWeeks);

    const perWorkdays = perWorkdaysPlusWeek / remainingWeeks;
    // console.log('perWorkdays', perWorkdaysPlusWeek, remainingWeeks,  Math.ceil(perWorkdaysPlusWeek / remainingWeeks));

    // console.log('Per workdays:', perWorkdays);
    // @ts-ignore
    self.registration.showNotification('WFO提醒', {
      title: 'WFO提醒',
      body: perWorkdays === 0 ? `您已无需WFO了！` : `按照您当前已经确认${existingWFOdates.length}工作日数，您接下来${remainingWeeks}需要每周去公司最少${perWorkdays.toFixed(2)}天， 建议每周${Math.ceil(perWorkdays)}天WFO！`,
      icon: '/icon/48.png',
      actions: [
        { action: 'ignore', title: '知道啦！' }
      ],
      requireInteraction: true
    });
  }
});
self.addEventListener('notificationclose', async event => {
  console.log('通知已关闭:', event);
  switch (event.notification.tag) {
    case 'wfo-reminder-today':
      await setCheckToday()
      break;
  }
  await notifications.clear(event.notification.tag)
});
console.log("[background.ts] Background script loaded.");