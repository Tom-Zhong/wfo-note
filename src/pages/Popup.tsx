import { useCallback, useEffect, useState } from 'react';
import { DayPicker } from "react-day-picker";
import { zhCN } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { eachDayOfInterval, isWeekend } from 'date-fns';
import StorageUtils from '@/utils/StorageUtils';

import "./Popup.css";

import { IoIosInformationCircleOutline } from "react-icons/io";
import { IoSettings } from "react-icons/io5";
import { Formatter } from '@/utils/Formatter';

export default function() {
  const [selected, setSelected] = useState<Date[] | undefined>();

  const [workDays, setWorkDays] = useState<any[]>([]);
  const [restDays, setRestDays] = useState<any[]>([]);
  const [realWorkDays, setRealWorkDays] = useState<number>(0);
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [currentMonthWorkDays, setCurrentMonthWorkDays] = useState<number>(0);
  const [currentMonthRestDays, setCurrentMonthRestDays] = useState<number>(0);
  // console.log('workDays:', workDays);
  // console.log('restDays:', restDays);

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
      const currentMonthWorkDays = storedWorkDays[`${year}-${month}`] || [];
      setCurrentMonthWorkDays(currentMonthWorkDays.length);
      console.log('storedWorkDays:', storedWorkDays);

      const storedRestDays = StorageUtils.load('restDays');
      const currentMonthRestDays = storedRestDays[`${year}-${month}`] || [];
      setCurrentMonthRestDays(currentMonthRestDays.length);
      console.log('storedRestDays:', storedRestDays);
    }
  }, [currentMonth, workDays, restDays]);

  useEffect(() => {
    console.log('currentMonthWorkDays', currentMonthWorkDays);
  }, [currentMonthWorkDays]);

  useEffect(() => {
    console.log('realWorkDays', realWorkDays);
  }, [realWorkDays]);

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

  return (
    <div style={{}}>
      <div
        style={{
          padding: '10px',
          paddingBottom: '30px'
        }}
      >
        <h1>WFO笔记本</h1>
        <p>记录你的WFO时间</p>
        <div
        className='flex-column'
        style={{
          flexDirection: 'row',
        }}>
          <div style={{marginRight: '20px'}}>
            <h2 style={{marginBottom: '5px'}}>选择日期</h2>
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
            <div className='flex-row' style={{  width: '100%', gap: '10px', marginTop: '20px' }}>
              <div className='flex-row' style={{ alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: 'green'}}></div>
                <span>公司办公</span>
              </div>
              <div className='flex-row' style={{ alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '20px', height: '20px', backgroundColor: 'grey'}}></div>
                <span>休假</span>
              </div>
            </div>
            <h3 style={{fontSize: '20px'}}>
              您{currentMonth?.toLocaleString('default', { month: 'long', year: 'numeric' })}的WFO已达到
              { Math.floor(currentMonthWorkDays / (realWorkDays - currentMonthRestDays) * 100)} %
              </h3>
          </div>
          <div style={{marginRight: '20px', flexGrow: 1}}>
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
                <div style={{marginBottom: '10px', fontSize: '16px'}}>
                  <strong>已选择日期：</strong>
                  <span>{selected ? selected.map(date => date.toLocaleDateString()).join(", ") : "无"}</span>
                </div>
                <div style={{marginBottom: '10px', fontSize: '16px'}}><span>我准备：</span></div>
                <div className='flex-column' style={{flexDirection: 'row'}}>
                  <button style={{width: '100%', marginBottom: '10px'}} onClick={() => {
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
                  <button style={{width: '100%', marginBottom: '10px'}}
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
                </div>
              </div>
              <button style={{width: '100%', marginBottom: '10px'}} onClick={() => resetCurrentMonth()}>清除当月计划</button>
              <button style={{width: '100%', marginBottom: '10px'}} onClick={() => importLastMonthPlan()}>导入上月计划</button>
              <button style={{width: '100%'}}>导出所有计划到Excel</button>
              <p style={{marginTop: '15px', marginBottom: '0px'}}>* 仅支持追溯过去三个月和计划未来三月的WFO记录</p>
              <p style={{marginBottom: '0px'}}>* 请根据实际工作安排合理安排WFO时间</p>
              <p style={{marginTop: '0px'}}>* 本插件的WFO提示仅供参考，实际以公司的WFO为准</p>
            </div>
          </div>
        </div>
      </div>
      
      <div style={{
        height: '30px',
        position: 'fixed', bottom: '0', left: '0', right: '0',
        padding: '5px 10px',
        boxSizing: 'border-box',
        display: 'flex',
      }} className='gray-bg'>
        <IoIosInformationCircleOutline style={{fontSize: '18px', marginRight: '5px', cursor: 'unset'}} className='active'/>
        <IoSettings style={{fontSize: '18px', cursor: 'unset'}} className='active'/>
      </div>
    </div>
  )
}
