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

export default function () {
  const [selected, setSelected] = useState<Date[] | undefined>();

  const [workDays, setWorkDays] = useState<any[]>([]); // 所有月份的工作日
  const [restDays, setRestDays] = useState<any[]>([]); // 所有月份的休息日
  const [realWorkDays, setRealWorkDays] = useState<number>(0); // 实际工作天数
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date()); // 当前选择的月份
  const [currentMonthWorkDays, setCurrentMonthWorkDays] = useState<number>(0); // 当前月份已设定的工作日数量
  const [currentMonthRestDays, setCurrentMonthRestDays] = useState<number>(0); // 当前月份已设定的休息日数量
  const [alertMode, setAlertMode] = useState<string>(StorageUtils.load('alertMode') || 'flexible'); // strict, flexible, silent
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
    console.log('storedRestDays:', storedRestDays);
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
      const month = currentMonth.getMonth() + 1;

      const storedWorkDays = StorageUtils.load('workDays');
      if (storedWorkDays) {
        const currentMonthWorkDays = storedWorkDays[`${year}-${month}`] || [];
        setCurrentMonthWorkDays(currentMonthWorkDays.length);
        console.log('storedWorkDays:', storedWorkDays);
      }


      const storedRestDays = StorageUtils.load('restDays');
      if (storedRestDays) {
        const currentMonthRestDays = storedRestDays[`${year}-${month}`] || [];
        setCurrentMonthRestDays(currentMonthRestDays.length);
        console.log('storedRestDays:', storedRestDays);
      }
    }
  }, [currentMonth, workDays, restDays]);

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

  useEffect(() => {
    console.log('currentMonthWorkDays', currentMonthWorkDays);
  }, [currentMonthWorkDays]);

  useEffect(() => {
    console.log('realWorkDays', realWorkDays);
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
              <p>(当前月份是 {currentMonth?.toLocaleString('default', { month: 'long', year: 'numeric' })}, 共有{realWorkDays}个工作日)</p>
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
              <h3 style={{ fontSize: '20px' }}>
                您{currentMonth?.toLocaleString('default', { month: 'long', year: 'numeric' })}的WFO已达到
                {Math.floor(currentMonthWorkDays / (realWorkDays - currentMonthRestDays) * 100)} %
              </h3>
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
                        console.log('selectedTimes:', restDays, selectedTimes);
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
                <p style={{ marginTop: '0px' }}>* 本插件的WFO提示仅供参考，实际以公司的WFO为准</p>
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
          <p>版本：v1.0.0</p>
          <p>作者：Tom G Y Zung</p>
          <p>感谢您使用WFO笔记本！这个插件旨在帮助您更好地管理和记录您的远程办公时间。</p>
          <p>如果您有任何建议或反馈，欢迎通过以下方式联系我：</p>
          <ul>
            <li>电子邮件：<a href="mailto:81437455@qq.com">81437455@qq.com</a></li>
          </ul>
          <button onClick={() => setShowView(1)} style={{marginBottom: '15px'}}>返回主界面</button>
        </div>

        <div
          style={{
            display: showView === 3 ? 'block' : 'none',
          }}
        >
          <h1 style={{marginBottom: '10px'}}>设置</h1>
          {/* <p>目前暂无可配置选项，敬请期待！</p> */}
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
