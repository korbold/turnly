'use client';

import { useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, DateSelectArg, DatesSetArg, EventInput } from '@fullcalendar/core';
import type { Reservation, ReservationStatus } from '@/types/reservation';

const STATUS_COLORS: Record<ReservationStatus, { bg: string; text: string; border: string }> = {
  pending:     { bg: '#FFF5D9', text: '#946B00', border: '#FFBB38' },
  confirmed:   { bg: '#E7EDFF', text: '#1814F3', border: '#396AFF' },
  in_progress: { bg: '#F3E8FF', text: '#6B21A8', border: '#7C3AED' },
  completed:   { bg: '#DCFAF8', text: '#0E8A7D', border: '#16DBCC' },
  cancelled:   { bg: '#FFE2E6', text: '#C41432', border: '#FF4B4A' },
  no_show:     { bg: '#EDF1F7', text: '#5A6B85', border: '#718EBF' },
};

function toEvents(reservations: Reservation[]): EventInput[] {
  return reservations.map((r) => {
    const colors = STATUS_COLORS[r.status] ?? STATUS_COLORS.pending;
    return {
      id: r.id,
      title: r.client?.name ?? 'Sin cliente',
      start: r.scheduled_at,
      end: r.estimated_end || undefined,
      backgroundColor: colors.bg,
      borderColor: colors.border,
      textColor: colors.text,
      extendedProps: { reservation: r },
    };
  });
}

interface ReservationCalendarProps {
  reservations: Reservation[];
  onEventClick: (reservation: Reservation) => void;
  onDateSelect: (dateStr: string) => void;
  onDatesChange: (start: string, end: string) => void;
}

export function ReservationCalendar({
  reservations,
  onEventClick,
  onDateSelect,
  onDatesChange,
}: ReservationCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null);

  const handleEventClick = (info: EventClickArg) => {
    const reservation = info.event.extendedProps.reservation as Reservation;
    onEventClick(reservation);
  };

  const handleDateSelect = (info: DateSelectArg) => {
    onDateSelect(info.startStr);
  };

  const handleDatesSet = (info: DatesSetArg) => {
    const start = info.startStr.split('T')[0];
    const end = info.endStr.split('T')[0];
    onDatesChange(start, end);
  };

  return (
    <div className="fc-bankdash">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: 'dayGridMonth,timeGridWeek,timeGridDay',
          center: 'title',
          right: 'today prev,next',
        }}
        locale="es"
        firstDay={1}
        selectable
        selectMirror
        dayMaxEvents={3}
        events={toEvents(reservations)}
        eventClick={handleEventClick}
        select={handleDateSelect}
        datesSet={handleDatesSet}
        height="auto"
        buttonText={{
          today: 'Hoy',
          month: 'Mes',
          week: 'Semana',
          day: 'Día',
        }}
        eventTimeFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        slotMinTime="06:00:00"
        slotMaxTime="22:00:00"
        allDaySlot={false}
        nowIndicator
      />
    </div>
  );
}
