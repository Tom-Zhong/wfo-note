import { useEffect, useState } from 'react';
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { eachDayOfInterval, isWeekend } from 'date-fns';

import "./Popup.css";

export default function() {
  const [selected, setSelected] = useState<Date[] | undefined>();

  const [workDays, setWorkDays] = useState<any[]>([]);
  const [restDays, setRestDays] = useState<any[]>([]);
  const [realWorkDays, setRealWorkDays] = useState<number>(0);
  // console.log('workDays:', workDays);
  // console.log('restDays:', restDays);

  useEffect(() => {
    console.log("[WFO-Note] App runs ok!!!");
  }, []);

  useEffect(() => {
    // console.log('Selected dates changed:', selected);
    if (!selected || selected.length === 0) {
      return;
    }

    const start = new Date(selected[0]);
    start.setDate(1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const days = eachDayOfInterval({ start, end });
    const workdays = days.filter(day => !isWeekend(day)).length;

    setRealWorkDays(workdays);
    // console.log(workdays);
  }, [selected]);

  return (
    <div>
      <h1>WFO笔记本</h1>
      <p>记录你的WFO时间</p>
      <div
      className='flex-column'
      style={{
        flexDirection: 'row',
      }}>
        <div style={{marginRight: '20px'}}>
          <h2>选择日期</h2>
          <DayPicker
            animate
            mode="multiple"
            selected={selected}
            modifiers={{
              workDays: workDays,
              restDays: restDays,
            }}
            modifiersClassNames={{
              workDays: "my-booked-class",
              restDays: "my-booked-class1",
            }}
            disabled={{
              dayOfWeek: [0, 6]
            }}
            onSelect={setSelected}
            // footer={
            //   selected ? `Selected: ${selected.toLocaleDateString()}` : "Pick a day."
            // }
          />
          <div className='flex-row' style={{  width: '100%', gap: '10px', marginTop: '5px' }}>
            <div className='flex-row' style={{ alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '10px', height: '10px', backgroundColor: 'green'}}></div>
              <span>公司办公</span>
            </div>
            <div className='flex-row' style={{ alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '10px', height: '10px', backgroundColor: 'grey'}}></div>
              <span>休假</span>
            </div>
          </div>
          <h3 style={{fontSize: '18px'}}>
            您本月的WFO已达到
            { Math.floor(workDays.length / (realWorkDays - restDays.length) * 100)} %
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
                  console.log('Selected dates:', selected);
                  setSelected([]);
                  console.log(typeof selected?.[0]);
                  if (selected && selected.length > 0) {
                    const selectedTimes = selected.map(item => item.getTime());
                    setWorkDays([...workDays, ...selected]);
                    // Remove from restDays if exists
                    setRestDays(restDays.filter(
                      date => date.getTime() !== selectedTimes.includes(date.getTime())));
                  }
                }}>公司办公</button>
                <button style={{width: '100%', marginBottom: '10px'}}
                  onClick={() => {
                    if (selected && selected.length > 0) {
                      const selectedTimes = selected.map(item => item.getTime());
                      setRestDays([...restDays, ...selected]);
                      // Remove from workDays if exists
                      setWorkDays(workDays.filter(
                        date => date.getTime() !== selectedTimes.includes(date.getTime())));
                    }
                  }}>休假</button>
              </div>
            </div>
            <button style={{width: '100%', marginBottom: '10px'}}>清除当月计划</button>
            <button style={{width: '100%', marginBottom: '10px'}}>导入上月计划</button>
            <button style={{width: '100%'}}>导出所有计划到Excel</button>
          </div>
        </div>
      </div>

    </div>
  )
}
