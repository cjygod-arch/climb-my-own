/**
 * features/records/ui/RecordListItem.js — 기록 한 건.
 *
 * 표현은 shared/ui/EntryRow가 하고, 이 파일은 '기록 → 표시값' 변환만 책임진다.
 * 도메인 지식이 shared로 새어들지 않게 하는 경계다.
 */

import { km, weekday } from '../../../core/format.js';
import { EntryRow } from '../../../shared/ui/EntryRow.js';

/**
 * @param {{ record: object, onSelect: (id: string) => void }} props
 */
export function RecordListItem({ record, onSelect }) {
  return EntryRow({
    day: record.hikedOn.slice(8, 10).replace(/^0/, ''),
    weekday: weekday(record.hikedOn),
    title: record.mountainName,
    note: record.memo,
    value: km(record.distanceKm),
    unit: 'KM',
    onSelect: () => onSelect(record.id),
  });
}
