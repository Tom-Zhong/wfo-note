import { useCallback, useEffect, useState } from 'react';
import { DayPicker } from "react-day-picker";
import { el, zhCN } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { eachDayOfInterval, isWeekend } from 'date-fns';
import { utils, writeFile } from 'xlsx';
import StorageUtils from '@/utils/StorageUtils';
import Browser from 'webextension-polyfill';

import "./Popup.css";

import { FaHome } from "react-icons/fa";
import { IoIosInformationCircleOutline } from "react-icons/io";
import { IoSettings } from "react-icons/io5";
import { Formatter } from '@/utils/Formatter';
import CommonUtils from '@/utils/CommonUtils';

/**
 * 自动清除无用的数据
 * 1. 当前前三个月以前的数据（比如说当前十二月， 那么八月的数据就是要被丢弃的）
 * 
 */
function autoClearUnusedData () {
  const start = new Date();
  const year = start.getFullYear();
  const month = start.getMonth() - 3;
  const storedWorkDays = StorageUtils.load('workDays');

  // console.log('autoClearUnusedData:', `${year}-${month}`);
  if (storedWorkDays && storedWorkDays[`${year}-${month}`]) {
    delete storedWorkDays[`${year}-${month}`];
    StorageUtils.save('workDays', storedWorkDays);
    // console.log('autoClearUnusedData done', `${year}-${month}`);
  }

  console.log('[WFO-Note] Auto Clear UnusedData Done');
}

export default function () {
  const [selected, setSelected] = useState<Date[] | undefined>();

  const [workDays, setWorkDays] = useState<any[]>([]); // 所有月份的工作日
  const [restDays, setRestDays] = useState<any[]>([]); // 所有月份的休息日
  const [realWorkDays, setRealWorkDays] = useState<number>(0); // 实际工作天数
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date()); // 当前选择的月份
  const [currentMonthWorkDays, setCurrentMonthWorkDays] = useState<number>(0); // 当前月份已设定的工作日数量
  const [currentMonthRestDays, setCurrentMonthRestDays] = useState<number>(0); // 当前月份已设定的休息日数量
  const [currentUserWfoDatesLength, setCurrentUserWfoDatesLength] = useState<number>(0); // 用户确认到公司办公的天数
  const [alertMode, setAlertMode] = useState<string>(StorageUtils.load('alertMode') || 'flexible'); // strict, flexible, silent
  const [wfoRatio, setWfoRatio] = useState<number>(Number(StorageUtils.load('wfoRatio')) || 40);
  const [remindBefore1day, setRemindBefore1day] = useState<boolean>(StorageUtils.load('remindBefore1day') || false);
  const [alertModeErrState, setAlertModeErrState] = useState<string>('');

  const [showView, setShowView] = useState<number>(1); // 1: main, 2: about, 3: settings
  const [activeMenu, setActiveMenu] = useState<string>('');
  // console.log('workDays:', workDays);
  // console.log('restDays:', restDays);
  // 主题切换
  const [theme, setTheme] = useState<string>(() => {
    return localStorage.getItem('theme') || CommonUtils.getSystemTheme();
  });

  useEffect(() => {
    document.body.classList.remove('dark-mode', 'light-mode');
    document.body.classList.add(theme === 'dark' ? 'dark-mode' : 'light-mode');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  useEffect(() => {
    console.log("[WFO-Note] App runs ok!!!");
    const storedWorkDays = StorageUtils.load('workDays');
    let loadedWorkDays: Date[] = [];
    Object.keys(storedWorkDays || {}).forEach((key) => {
      const dateStrArr = storedWorkDays[key];
      loadedWorkDays = loadedWorkDays.concat(dateStrArr.map((date: string) => new Date(date)));
    });
    // console.log('loadedWorkDays:', loadedWorkDays);
    setWorkDays(loadedWorkDays);
    // if (storedWorkDays) {
    //   setWorkDays(storedWorkDays.map((time: number) => new Date(time)));
    // }
    const storedRestDays = StorageUtils.load('restDays');
    // console.log('storedRestDays:', storedRestDays);
    let loadedRestDays: Date[] = [];
    Object.keys(storedRestDays || {}).forEach((key) => {
      const dateStrArr = storedRestDays[key];
      loadedRestDays = loadedRestDays.concat(dateStrArr.map((date: string) => new Date(date)));
    });
    // console.log('loadedRestDays:', loadedRestDays);
    setRestDays(loadedRestDays);
    setCurrentMonth(new Date());
    // if (storedRestDays) {
    //   setRestDays(storedRestDays.map((time: number) => new Date(time)));
    // }
    autoClearUnusedData();

    // get message from background.ts
    Browser.runtime.onMessage.addListener((message) => {
      if (message.type === 'userWfoDates') {
        console.log(message.payload);
        if (message.payload) {
          const userWfoDatesArray = message.payload[`userWfoDates_${message.payload.currentMonth}`];
          console.log(userWfoDatesArray);
          StorageUtils.save(`userWfoDates_${message.payload.currentMonth}`, userWfoDatesArray);
          setCurrentUserWfoDatesLength(userWfoDatesArray.length);
        } else {
          setCurrentUserWfoDatesLength(0);
        }
      }
    });
  }, []);

  useEffect(() => {
    if (currentMonth) {
      const start = new Date(currentMonth);
      start.setDate(1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      const days = eachDayOfInterval({ start, end });
      const workdays = days.filter(day => !isWeekend(day)).length;
      setRealWorkDays(workdays);

      const year = currentMonth.getFullYear();
      const month = (currentMonth.getMonth() + 1).toString().padStart(2, '0')

      const storedWorkDays = StorageUtils.load('workDays');
      if (storedWorkDays) {
        const currentMonthWorkDays = storedWorkDays[`${year}-${month}`] || [];
        setCurrentMonthWorkDays(currentMonthWorkDays.length);
        // console.log('storedWorkDays:', storedWorkDays);
      }


      const storedRestDays = StorageUtils.load('restDays');
      if (storedRestDays) {
        const currentMonthRestDays = storedRestDays[`${year}-${month}`] || [];
        setCurrentMonthRestDays(currentMonthRestDays.length);
        // console.log('storedRestDays:', storedRestDays);
      }
      const workDays = StorageUtils.load('workDays');
      Browser.runtime.sendMessage({ type: "storageWorkdays", payload: workDays });

      // 导入userWfoDates for current month from localStorage
      // const userWfoDates = StorageUtils.load(`userWfoDates_${year}-${month}`);
      // setCurrentUserWfoDatesLength(userWfoDates ? userWfoDates.length : 0);
    }
  }, [currentMonth, workDays, restDays]);

  useEffect(() => {
    // console.log('yes');
    Browser.runtime.sendMessage({ type: "userWfoDates", payload: currentMonth });
  }, [currentMonth])

  const handleAlertModeChange = useCallback((mode: string) => {
    setAlertMode(mode);
    StorageUtils.save('alertMode', mode);
    const workDays = StorageUtils.load('workDays');
    Browser.runtime.sendMessage({ type: "storageMode", payload: mode });
    Browser.runtime.sendMessage({ type: "storageWorkdays", payload: workDays });

    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification('WFO笔记本', {
          body: `提醒模式已切换为：${mode === 'strict' ? 'WFO日提醒模式（按照您设定的WFO进行提醒）' : mode === 'flexible' ? '灵活模式（每个工作日都会提醒您）' : '静音模式（由您自行安排WFO）'}`,
        });
      } else {
        setAlertModeErrState('无法启用提醒模式，请允许通知权限');
        console.log('Notification permission denied');
      }
    });
  }, []);

  const handleRemindBefore1dayCange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    // @ts-ignore
    const val = event.target.checked;
    setRemindBefore1day(val);
    StorageUtils.save('remindBefore1day', val);
    Browser.runtime.sendMessage({ type: "remindBefore1day", payload: {
      remindBefore1day: val
    }});
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification('WFO笔记本', {
          body: val ? `将会在计划WFO前一天提醒您要WFO` : `已取消提前一日提醒您要WFO`,
        });
      } else {
        setAlertModeErrState('无法启用提醒模式，请允许通知权限');
        console.log('Notification permission denied');
      }
    });
  }, []);

  const handleWfoRatioChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => { 
    const val = event.target.value;
    setWfoRatio(Number(val));
    console.log('wfoRatio', val)
    StorageUtils.save('wfoRatio', Number(val));
    Browser.runtime.sendMessage({ type: "wfoRatio", payload: {
      wfoRatio: Number(val)
    }});
  }, []);

  useEffect(() => {
    // console.log('currentMonthWorkDays', currentMonthWorkDays);
  }, [currentMonthWorkDays]);

  useEffect(() => {
    // console.log('realWorkDays', realWorkDays);
    // 将当前全月工作日数和休息日数传给background.ts
    Browser.runtime.sendMessage({ type: "storageCurrentUserWorkdays", payload: { 
      currentUserWorkdays: realWorkDays - currentMonthRestDays
    }});
  }, [realWorkDays, currentMonthRestDays]);

  const resetCurrentMonth = useCallback(() => {
    const storedWorkDays = StorageUtils.load('workDays');
    const storedRestDays = StorageUtils.load('restDays');

    const year = currentMonth?.getFullYear();
    const month = currentMonth ? currentMonth.getMonth() + 1 : 0;

    if (storedWorkDays && storedWorkDays[`${year}-${month}`]) {
      delete storedWorkDays[`${year}-${month}`];
      StorageUtils.save('workDays', storedWorkDays);
    }
    if (storedRestDays && storedRestDays[`${year}-${month}`]) {
      delete storedRestDays[`${year}-${month}`];
      StorageUtils.save('restDays', storedRestDays);
    }
    setWorkDays(workDays.filter(date => {
      return !(date.getFullYear() === year && (date.getMonth() + 1) === month);
    }));
    setRestDays(restDays.filter(date => {
      return !(date.getFullYear() === year && (date.getMonth() + 1) === month);
    }));
  }, [currentMonth, workDays, restDays]);

  const importLastMonthPlan = useCallback(() => {
    const lastMonthDate = new Date(currentMonth);
    lastMonthDate.setMonth(currentMonth.getMonth() - 1);
    const year = lastMonthDate.getFullYear();
    const month = lastMonthDate.getMonth() + 1;
    // get current month real days
    const currentMonthRealDays = eachDayOfInterval({
      start: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
      end: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
    });
    const currentMonthRealDaysLength = currentMonthRealDays.length;

    const storedWorkDays = StorageUtils.load('workDays');
    const lastMonthWorkDays = storedWorkDays[`${year}-${month}`] || [];
    // console.log('lastMonthWorkDays:', lastMonthWorkDays);

    const storedRestDays = StorageUtils.load('restDays');
    const lastMonthRestDays = storedRestDays[`${year}-${month}`] || [];
    // console.log('lastMonthRestDays:', lastMonthRestDays);

    const currentYear = currentMonth?.getFullYear();
    const currentMonthNum = currentMonth ? currentMonth.getMonth() + 1 : 0;

    const newWorkDays = lastMonthWorkDays.map((dateStr: string) => {
      const date = new Date(dateStr);
      const theBigestDay = currentMonthRealDaysLength;
      if (date.getDate() > theBigestDay) {
        return new Date(currentYear!, currentMonthNum - 1, theBigestDay);
      }
      return new Date(currentYear!, currentMonthNum - 1, date.getDate());
    }).filter((date: Date) => {
      // filter weekend dates
      return !isWeekend(date);
    });
    const newRestDays = lastMonthRestDays.map((dateStr: string) => {
      const date = new Date(dateStr);
      const theBigestDay = currentMonthRealDaysLength;
      if (date.getDate() > theBigestDay) {
        return new Date(currentYear!, currentMonthNum - 1, theBigestDay);
      }
      return new Date(currentYear!, currentMonthNum - 1, date.getDate());
    }).filter((date: Date) => {
      // filter weekend dates
      return !isWeekend(date);
    });

    setWorkDays([...workDays, ...newWorkDays]);
    StorageUtils.checkExistAndSave('workDays', [...workDays, ...newWorkDays]);

    setRestDays([...restDays, ...newRestDays]);
    StorageUtils.checkExistAndSave('restDays', [...restDays, ...newRestDays]);
  }, [currentMonth, workDays, restDays]);

  const exportToExcel = useCallback(() => {
    const storedWorkDays = StorageUtils.load('workDays');
    const storedRestDays = StorageUtils.load('restDays');

    const data: any[] = [];
    const months = new Set<string>([
      ...Object.keys(storedWorkDays || {}),
      ...Object.keys(storedRestDays || {})
    ]);
    months.forEach((Month) => {
      const workDaysArr = storedWorkDays[Month] || [];
      const restDaysArr = storedRestDays[Month] || [];
      data.push({
        Month,
        WorkDays: workDaysArr.join(", "),
        RestDays: restDaysArr.join(", ")
      });
    });

    const worksheet = utils.json_to_sheet(data);
    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, "WFO Plan");
    writeFile(workbook, "WFO_Plan.xlsx");
  }, []);

  const showActiveMenu = useCallback((element: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    const target = element.target as HTMLElement;
    // console.log(target);
    if (target?.classList.contains('active')) {
      // console.log('hovered element:', target);
      setActiveMenu(target.getAttribute('name') || '');
      return;
    }
  }, []);

  return (
    <div style={{}}>
      <div
        style={{
          padding: '10px',
          paddingBottom: '30px',
        }}
      >
        <button
          onClick={toggleTheme}
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            zIndex: 1000,
            padding: '4px 12px',
            borderRadius: '6px',
            border: '1px solid #888',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          {theme === 'dark' ? '切换浅色' : '切换深色'}
        </button>
        <div
          style={{
            display: showView === 1 ? 'block' : 'none',
          }}
        >
          <h1>WFO笔记本</h1>
          <p>记录你的WFO时间</p>
          <div
            className='flex-column'
            style={{
              flexDirection: 'row',
            }}>
            <div style={{ marginRight: '20px' }}>
              <h3 style={{ fontSize: '20px', marginTop: '10px', marginBottom: '5px', whiteSpace: 'nowrap', fontWeight: 'bold', padding: '2px 5px', border: '1px solid grey' }}>
                {currentMonth?.toLocaleString('default', { month: 'long' })}的计划WFO已达到
                {Math.floor(currentMonthWorkDays / (realWorkDays - currentMonthRestDays) * 100)} %
              </h3>
              <h3 style={{ fontSize: '10px', marginTop: '0px', whiteSpace: 'nowrap', fontWeight: 'normal' }}>
                {currentMonth?.toLocaleString('default', { month: 'long'})}的实际确认WFO天数为
                {currentUserWfoDatesLength}天, WFO为
                {Math.floor(currentUserWfoDatesLength / (realWorkDays - currentMonthRestDays) * 100)}%(计算方法为弹窗确认)
              </h3>
              <h2 style={{ marginBottom: '5px' }}>选择日期</h2>
              <p>(选择您计划的工作日或休息日)</p>
              <DayPicker
                animate
                mode="multiple"
                selected={selected}
                defaultMonth={new Date()}
                startMonth={new Date(new Date().getFullYear(), new Date().getMonth() - 3)}
                endMonth={new Date(new Date().getFullYear(), new Date().getMonth() + 3)}
                modifiers={{
                  workDays: workDays,
                  restDays: restDays,
                }}
                modifiersClassNames={{
                  workDays: "my-booked-class",
                  restDays: "my-booked-class1",
                }}
                disabled={{
                  dayOfWeek: [0, 6],
                }}
                onSelect={setSelected}
                onMonthChange={(month) => setCurrentMonth(month)}
                locale={zhCN}
                weekStartsOn={0}
              />
              <p style={{marginTop: '5px'}}>(当前月份是 {currentMonth?.toLocaleString('default', { month: 'long', year: 'numeric' })}, 共有{realWorkDays}个工作日)</p>

              <div className='flex-row' style={{ width: '100%', gap: '10px', marginTop: '20px' }}>
                <div className='flex-row' style={{ alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '20px', height: '20px', backgroundColor: 'green' }}></div>
                  <span>公司办公</span>
                </div>
                <div className='flex-row' style={{ alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '20px', height: '20px', backgroundColor: 'grey' }}></div>
                  <span>休假</span>
                </div>
              </div>
            </div>
            <div style={{ marginRight: '20px', flexGrow: 1 }}>
              <h2 style={{
                textAlign: 'center'
              }}>菜单</h2>
              <div>
                <div style={{
                  marginBottom: '20px',
                  border: '1px solid #ccc',
                  padding: '10px',
                  borderRadius: '5px'
                }}>
                  <div style={{ marginBottom: '10px', fontSize: '16px' }}>
                    <strong>已选择日期：</strong>
                    <span>{selected ? selected.map(date => date.toLocaleDateString()).join(", ") : "无"}</span>
                  </div>
                  <div style={{ marginBottom: '10px', fontSize: '16px' }}><span>我准备：</span></div>
                  <div className='flex-column' style={{ flexDirection: 'row' }}>
                    <button style={{ width: '100%', marginBottom: '10px' }} onClick={() => {
                      if (selected && selected.length > 0) {
                        const selectedTimes = selected.map(item => Formatter.formatDateToString(item));
                        setWorkDays([...workDays, ...selected]);
                        StorageUtils.checkExistAndSave('workDays', [...workDays, ...selected]);
                        // console.log('selectedTimes:', restDays, selectedTimes);
                        setRestDays(restDays.filter(
                          date => !selectedTimes.includes(Formatter.formatDateToString(date))));
                        StorageUtils.checkExistAndRemove('restDays', selected);
                      }
                      setSelected([]);
                    }}>公司办公</button>
                    <button style={{ width: '100%', marginBottom: '10px' }}
                      onClick={() => {
                        if (selected && selected.length > 0) {
                          const selectedTimes = selected.map(item => Formatter.formatDateToString(item));
                          setRestDays([...restDays, ...selected]);
                          StorageUtils.checkExistAndSave('restDays', [...restDays, ...selected]);
                          setWorkDays(workDays.filter(
                            date => !selectedTimes.includes(Formatter.formatDateToString(date))));
                          StorageUtils.checkExistAndRemove('workDays', selected);
                        }
                        setSelected([]);
                      }}>休假</button>
                    <button style={{ width: '100%', marginBottom: '10px' }}
                      onClick={() => {
                        if (selected && selected.length > 0) {
                          const selectedTimes = selected.map(item => Formatter.formatDateToString(item));
                          setWorkDays(workDays.filter(
                            date => !selectedTimes.includes(Formatter.formatDateToString(date))));
                          StorageUtils.checkExistAndRemove('workDays', selected);
                          setRestDays(restDays.filter(
                            date => !selectedTimes.includes(Formatter.formatDateToString(date))));
                          StorageUtils.checkExistAndRemove('restDays', selected);
                        }
                        setSelected([]);
                      }}>清除选中日期</button>
                  </div>
                </div>
                <button style={{ width: '100%', marginBottom: '10px' }} onClick={() => resetCurrentMonth()}>清除当月计划</button>
                <button style={{ width: '100%', marginBottom: '10px' }} onClick={() => importLastMonthPlan()}>导入上月计划</button>
                <button style={{ width: '100%' }} onClick={() => exportToExcel()}>导出所有计划到Excel</button>
                <p style={{ marginTop: '15px', marginBottom: '0px' }}>* 仅支持追溯过去三个月和计划未来三月的WFO记录</p>
                <p style={{ marginBottom: '0px' }}>* 请根据实际工作安排合理安排WFO时间</p>
                <p style={{ marginBottom: '0px' }}>* 本插件的WFO提示仅供参考，实际以公司的WFO为准</p>
                <p style={{ marginTop: '0px' }}>* 实际确认WFO天数统计是您需要在通知栏弹出通知询问您是否当日已经WFO，点击"是"才会进行统计。</p>
              </div>
            </div>
          </div>
        </div>


        <div
          style={{
            display: showView === 2 ? 'block' : 'none',
          }}
        >
          <h1 style={{marginBottom: '10px'}}>关于 WFO笔记本</h1>
          <p>版本：v1.0.0 Beta</p>
          <p>作者：Tom Zung</p>
          <p>感谢您使用WFO笔记本！这个插件旨在帮助您更好地管理和记录您的公司办公时间。</p>
          <p>本插件基于React和vite-plugin-web-extension开发，使用React Hooks进行状态管理。</p>
          <p>当前实现功能</p>
          <ol>
            <li>计划WFO时间（可以计划工作日，休息日）</li>
            <li>计算WFO比率（帮助您计算你的WFO比率）</li>
            <li>导出所有计划到Excel （可以导出您已经计划好的WFO计划）</li>
            <li>设置提醒模式（按照WFO计划提醒， 每日提醒或者静默不提醒）</li>
            <li>设置提前一天WFO提醒（按照您的计划，可以提前一天告诉您明天要WFO）</li>
          </ol>
          <p>如果您有任何建议或反馈，欢迎通过以下方式联系我：</p>
          <ul>
            <li>GitHub：<a href="https://github.com/Tom-Zhong/wfo-note">https://github.com/Tom-Zhong/wfo-note</a></li>
          </ul>
          <button onClick={() => setShowView(1)} style={{marginBottom: '15px'}}>返回主界面</button>
        </div>

        <div
          style={{
            display: showView === 3 ? 'block' : 'none',
          }}
        >
          <h1 style={{marginBottom: '10px'}}>设置</h1>
          <div>
            <h2>提醒模式</h2>
            <input type="radio" id="mode1" name="remindMode" value="strict" onChange={() => handleAlertModeChange('strict')} checked={alertMode === 'strict'} />
            <label htmlFor="mode1"> WFO日提醒模式（仅按计划的WFO日进行提醒，需要您提前在WFO中设置WFO日）</label><br />
            <input type="radio" id="mode2" name="remindMode" value="flexible" onChange={() => handleAlertModeChange('flexible')} checked={alertMode === 'flexible'} />
            <label htmlFor="mode2"> 灵活模式（每个工作日均提醒，每日只提醒一次）</label><br />
            <input type="radio" id="mode3" name="remindMode" value="silent" onChange={() => handleAlertModeChange('silent')} checked={alertMode === 'silent'} />
            <label htmlFor="mode3"> 静音模式（不进行任何提醒, 由您自行规划）</label><br />
            { alertModeErrState && <p style={{ color: 'red', margin: '10px 0' }}>{alertModeErrState}</p> }
          </div>

          <div>
            <h2>WFO比例</h2>
            <input type="radio" id="wfoRatio1" name="wfoRatio" value="40" onChange={(target) => handleWfoRatioChange(target)} checked={ wfoRatio === 40 } />
            <label htmlFor="wfoRatio1"> 40% </label><br />
            <input type="radio" id="wfoRatio2" name="wfoRatio" value="60" onChange={(target) => handleWfoRatioChange(target)} checked={ wfoRatio === 60 } />
            <label htmlFor="wfoRatio2"> 60% </label><br />
          </div>

          <div>
            <h2>可选设置</h2>
            <input type="checkbox" id="remindeBefore1day" name="remindeBefore1day" onChange={(target) => handleRemindBefore1dayCange(target)} checked={remindBefore1day} />
            <label htmlFor="remindeBefore1day">提前一日提醒我要WFO</label><br />
          </div>

          <button onClick={() => setShowView(1)} style={{margin: '15px 0 20px 0'}}>返回主界面</button>
        </div>
      </div>

      <div style={{
        height: '30px',
        position: 'fixed', bottom: '0', left: '0', right: '0',
        padding: '5px 10px',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: '5px'
      }} className='gray-bg' onMouseOver={(target) => showActiveMenu(target)} onMouseLeave={() => setActiveMenu('')}>
        <FaHome style={{ fontSize: '18px', cursor: 'unset' }} className='active' name='主页' onClick={() => setShowView(1)} />
        <IoSettings style={{ fontSize: '18px', cursor: 'unset' }} className='active' name='设置' onClick={() => setShowView(3)} />
        <IoIosInformationCircleOutline style={{ fontSize: '18px', marginRight: '0px', cursor: 'unset' }} className='active' name='关于' onClick={() => setShowView(2)} />
        <h4>{activeMenu}</h4>
      </div>
    </div>
  )
}
