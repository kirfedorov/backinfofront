import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIcon as Activity,
  BellRingingIcon as BellRinging,
  CalendarBlankIcon as CalendarBlank,
  ChartLineUpIcon as ChartLineUp,
  CaretLeftIcon as CaretLeft,
  CaretRightIcon as CaretRight,
  BroadcastIcon as Broadcast,
  CheckCircleIcon as CheckCircle,
  ClockIcon as Clock,
  CommandIcon as Command,
  DesktopIcon as Desktop,
  FirstAidIcon as FirstAid,
  IdentificationBadgeIcon as IdentificationBadge,
  MoonStarsIcon as MoonStars,
  PaperPlaneTiltIcon as PaperPlaneTilt,
  ShieldCheckIcon as ShieldCheck,
  StethoscopeIcon as Stethoscope,
  SunIcon as Sun,
  TelegramLogoIcon as TelegramLogo,
  FloppyDiskIcon as FloppyDisk,
  PencilSimpleIcon as PencilSimple,
  PlusIcon as Plus,
  TrashIcon as Trash,
  UserCheckIcon as UserCheck,
  UserGearIcon as UserGear,
  UserMinusIcon as UserMinus,
  UsersThreeIcon as UsersThree,
  WifiHighIcon as WifiHigh,
  XIcon as X,
  UploadSimpleIcon as UploadSimple,
  FilmStripIcon as FilmStrip,
  ImageSquareIcon as ImageSquare,
  ArrowUpIcon as ArrowUp,
  ArrowDownIcon as ArrowDown,
  ListIcon as List,
  SlidersHorizontalIcon as SlidersHorizontal,
} from "@phosphor-icons/react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { QRCodeSVG } from "qrcode.react";
import Cropper from "react-easy-crop";

const navItems = [
  { id: "overview", label: "Обзор", icon: Activity, meta: "Система" },
  { id: "doctors", label: "Врачи", icon: Stethoscope, meta: "Расписание" },
  { id: "administrators", label: "Админы", icon: UserGear, meta: "Календарь" },
  { id: "schedules", label: "Графики", icon: ChartLineUp, meta: "Все смены" },
  { id: "adminSchedules", label: "График админов", icon: CalendarBlank, meta: "Сводка" },
  { id: "monthlyLoad", label: "TimeWork", icon: ChartLineUp, meta: "За месяц" },
  { id: "media", label: "Медиатека", icon: FilmStrip, meta: "Фото и видео" },
  { id: "users", label: "Telegram", icon: UsersThree, meta: "Доступы" },
  { id: "commands", label: "Команды", icon: Command, meta: "Управление" },
];
const mainNavItems = navItems.filter((item) => !["administrators", "adminSchedules", "media", "users"].includes(item.id));
const administratorNavItems = [
  { id: "adminDashboard", label: "Обзор админов", icon: Activity, meta: "Dashboard" },
  { id: "administrators", label: "Администраторы", icon: UserGear, meta: "Список и календарь" },
  { id: "adminSchedules", label: "Графики админов", icon: CalendarBlank, meta: "Смены и время" },
  { id: "adminLoad", label: "Загрузка админов", icon: ChartLineUp, meta: "За месяц" },
  { id: "users", label: "Telegram", icon: UsersThree, meta: "Пользователи и роли" },
];
const mediaNavItems = [
  { id: "mediaLibrary", label: "Медиатека", icon: FilmStrip, meta: "Все файлы" },
  { id: "mediaUpload", label: "Загрузка", icon: UploadSimple, meta: "Добавить файлы" },
  { id: "displaySettings", label: "Настройки экрана", icon: SlidersHorizontal, meta: "Только админ" },
];
const activityData = [
  { time: "08:00", requests: 18, telegram: 9 }, { time: "10:00", requests: 31, telegram: 16 },
  { time: "12:00", requests: 24, telegram: 14 }, { time: "14:00", requests: 42, telegram: 22 },
  { time: "16:00", requests: 36, telegram: 19 }, { time: "18:00", requests: 53, telegram: 28 },
  { time: "20:00", requests: 47, telegram: 25 },
];
const weekdays = [["ПН", 1], ["ВТ", 2], ["СР", 3], ["ЧТ", 4], ["ПТ", 5], ["СБ", 6], ["ВС", 0]];

async function api(path, options) {
  let telegramUserId = "";
  try { telegramUserId = JSON.parse(sessionStorage.getItem("backinfo-qr-user"))?.id || ""; } catch { /* no session */ }
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(telegramUserId ? { "x-telegram-user-id": telegramUserId } : {}),
      ...(options?.headers || {}),
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Ошибка запроса");
  return body;
}

function AccessGate({ onApproved }) {
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  const createSession = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const next = await api("/api/auth/qr/session", { method: "POST" });
      setSession(next);
      setStatus(next.status);
    } catch (requestError) {
      setError(requestError.message);
      setStatus("error");
    }
  }, []);

  useEffect(() => { createSession(); }, [createSession]);
  useEffect(() => {
    if (!session || !["pending", "scanned"].includes(status)) return undefined;
    const interval = setInterval(async () => {
      try {
        const result = await api(`/api/auth/qr/session/${session.id}/status?key=${encodeURIComponent(session.pollKey)}`);
        setStatus(result.status);
        if (result.status === "approved") onApproved(result.telegramUser);
      } catch (requestError) {
        setError(requestError.message);
        setStatus("error");
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [session, status, onApproved]);

  async function cancelSession() {
    if (!session) return;
    try {
      await api(`/api/auth/qr/session/${session.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({ pollKey: session.pollKey }),
      });
      setStatus("cancelled");
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  const messages = {
    loading: "Создаём защищённый QR-код…",
    pending: "Отсканируйте QR-код телефоном",
    scanned: "Запрос отправлен. Подтвердите вход в Telegram",
    approved: "Вход разрешён. Открываем dashboard…",
    denied: "Вход отклонён в Telegram",
    expired: "Время действия QR-кода истекло",
    cancelled: "Вход отменён",
    error: "Не удалось создать QR-код",
  };

  return <div className="access-gate">
    <div className="access-card qr-access-card">
      <img src="/assets/neonmate-plus-logo.png" alt="NeonMate Plus" />
      <div className="access-icon"><TelegramLogo size={30} weight="duotone" /></div>
      <span>ВХОД ЧЕРЕЗ TELEGRAM</span>
      <h1>Backinfo Dashboard</h1>
      <p>{messages[status]}</p>
      {session && ["pending", "scanned"].includes(status) &&
        <div className={`qr-code-box ${status === "scanned" ? "scanned" : ""}`}>
          <QRCodeSVG value={session.approvalUrl} size={220} level="M" includeMargin />
        </div>}
      {session?.code && <div className="qr-session-code">Код входа: <strong>{session.code}</strong></div>}
      {error && <div className="access-error">{error}</div>}
      {["loading", "pending", "scanned"].includes(status)
        ? <button className="qr-cancel" disabled={status === "loading"} onClick={cancelSession}>Отменить вход</button>
        : status !== "approved" && <button onClick={createSession}>Создать новый QR-код</button>}
      <small>Откройте камеру телефона, перейдите в Telegram и нажмите «Разрешить вход». Страница откроется автоматически.</small>
    </div>
  </div>;
}

function StatCard({ icon: Icon, label, value, detail, tone = "blue" }) {
  return <article className={`stat-card tone-${tone}`}>
    <div className="stat-top"><span>{label}</span><Icon size={18} weight="duotone" /></div>
    <strong>{value}</strong><small><CheckCircle size={13} weight="fill" /> {detail}</small>
  </article>;
}

function DisplaySettings({ display, onSaved, setToast }) {
  const [showEverySeconds, setShowEverySeconds] = useState(display.showEverySeconds || 45);
  const [displayTheme, setDisplayTheme] = useState(display.theme || "dark");
  const [weatherLocation, setWeatherLocation] = useState(display.weatherLocation || {
    name: "Москва", latitude: 55.7558, longitude: 37.6176,
  });
  const [pages, setPages] = useState(display.pages || {
    doctors: { enabled: true, durationSeconds: 15 },
    weather: { enabled: true, durationSeconds: 12 },
    calendar: { enabled: true, durationSeconds: 12 },
    currency: { enabled: true, durationSeconds: 12 },
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShowEverySeconds(display.showEverySeconds || 45);
    setDisplayTheme(display.theme || "dark");
    if (display.weatherLocation) setWeatherLocation(display.weatherLocation);
    if (display.pages) setPages(display.pages);
  }, [display.showEverySeconds, display.theme, display.weatherLocation, display.pages]);

  const pageCatalog = [
    ["doctors", "Расписание врачей", "Врачи, кабинеты и рабочие дни"],
    ["weather", "Погода", "Температура, влажность и ветер"],
    ["calendar", "Календарь и время", "Текущий месяц и большие часы"],
    ["currency", "Курсы валют", "Официальные курсы доллара и евро"],
  ];
  const enabledPageSeconds = pageCatalog.reduce((total, [id]) =>
    total + (pages[id]?.enabled ? Number(pages[id].durationSeconds || 0) : 0), 0);
  const fullCycleSeconds = Number(showEverySeconds || 0) * pageCatalog.filter(([id]) => pages[id]?.enabled).length
    + enabledPageSeconds;

  function updatePage(id, changes) {
    setPages((current) => ({
      ...current,
      [id]: { ...current[id], ...changes },
    }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/admin/display/settings", {
        method: "POST",
        body: JSON.stringify({
          showEverySeconds: Number(showEverySeconds),
          theme: displayTheme,
          weatherLocation: {
            ...weatherLocation,
            latitude: Number(weatherLocation.latitude),
            longitude: Number(weatherLocation.longitude),
          },
          pages,
        }),
      });
      setToast("Настройки переданы Electron и будут сохранены локально");
      await onSaved();
    } catch (error) {
      setToast(error.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="display-settings-layout">
    <form className="panel display-settings-card" onSubmit={save}>
      <div className="panel-title">
        <div><span>ЛОКАЛЬНЫЙ ELECTRON</span><strong>Параметры показа расписания</strong></div>
        <SlidersHorizontal size={22} weight="duotone" />
      </div>
      <p className="settings-description">
        После сохранения Electron заберёт изменения и запишет их в локальный
        файл <code>backelectron/config/display-settings.json</code>.
      </p>
      <div className="settings-fields">
        <label>
          <span>Медиаконтент между страницами</span>
          <div><input type="number" min="10" max="3600" step="1"
            value={showEverySeconds}
            onChange={(event) => setShowEverySeconds(event.target.value)} />
            <b>сек.</b></div>
          <small>Пауза с роликом/слайдами перед следующей инфостраницей</small>
        </label>
        <label>
          <span>Тема табло</span>
          <select value={displayTheme} onChange={(event) => setDisplayTheme(event.target.value)}>
            <option value="dark">Тёмная</option>
            <option value="light">Светлая</option>
          </select>
          <small>Тема полноэкранного расписания врачей</small>
        </label>
      </div>
      <div className="display-page-settings">
        {pageCatalog.map(([id, title, description]) => <article className={`display-page-card ${pages[id]?.enabled ? "enabled" : ""}`} key={id}>
          <label className="page-toggle">
            <input type="checkbox" checked={Boolean(pages[id]?.enabled)}
              onChange={(event) => updatePage(id, { enabled: event.target.checked })} />
            <span><strong>{title}</strong><small>{description}</small></span>
          </label>
          <label className="page-duration">
            <span>Показывать</span>
            <input type="number" min="5" max="300" value={pages[id]?.durationSeconds || 12}
              disabled={!pages[id]?.enabled}
              onChange={(event) => updatePage(id, { durationSeconds: Number(event.target.value) })} />
            <b>сек.</b>
          </label>
        </article>)}
      </div>
      <div className="weather-location-settings">
        <strong>Местоположение для погоды</strong>
        <input value={weatherLocation.name}
          onChange={(event) => setWeatherLocation((current) => ({ ...current, name: event.target.value }))}
          placeholder="Город" />
        <input type="number" step="0.0001" value={weatherLocation.latitude}
          onChange={(event) => setWeatherLocation((current) => ({ ...current, latitude: event.target.value }))}
          placeholder="Широта" />
        <input type="number" step="0.0001" value={weatherLocation.longitude}
          onChange={(event) => setWeatherLocation((current) => ({ ...current, longitude: event.target.value }))}
          placeholder="Долгота" />
      </div>
      <button className="settings-save-button" disabled={saving} type="submit">
        <FloppyDisk size={18} /> {saving ? "Сохранение…" : "Сохранить настройки"}
      </button>
    </form>
    <article className="panel settings-status-card">
      <span>ТЕКУЩИЕ ЗНАЧЕНИЯ</span>
      <strong>{fullCycleSeconds} сек.</strong>
      <p>Полный цикл всех включённых страниц и медиаконтента</p>
      <div className="cycle-breakdown">
        <span>Инфостраницы <b>{enabledPageSeconds} сек.</b></span>
        <span>Медиа-блоки <b>{fullCycleSeconds - enabledPageSeconds} сек.</b></span>
        <span>Включено страниц <b>{pageCatalog.filter(([id]) => pages[id]?.enabled).length}</b></span>
      </div>
      <div className="settings-storage-note">
        <Desktop size={24} weight="duotone" />
        <div><b>Хранение на Electron</b><small>Backend держит только временное состояние синхронизации</small></div>
      </div>
    </article>
  </div>;
}

function DoctorRow({ doctor, onEdit, onDelete, canManage }) {
  const workingDays = new Set((doctor.schedule || []).map((item) => item.weekday));
  return <div className="doctor-row">
    <div className="doctor-avatar">{doctor.avatarUrl
      ? <img src={doctor.avatarUrl} alt="" />
      : <Stethoscope size={20} weight="duotone" />}</div>
    <div className="doctor-identity">
      <strong>{[doctor.lastName, doctor.firstName, doctor.middleName].filter(Boolean).join(" ")}</strong>
      <span>{doctor.specialty || "Специальность не указана"}</span>
    </div>
    <span className="room">Каб. {doctor.room || "—"}</span>
    <div className="weekdays">{weekdays.map(([label, value]) =>
      <span className={workingDays.has(value) ? "active" : ""} key={label}>{label}</span>)}</div>
    {canManage && <div className="doctor-actions">
      <button onClick={() => onEdit(doctor)} title="Редактировать"><PencilSimple size={16} /></button>
      <button className="delete" onClick={() => onDelete(doctor)} title="Удалить"><Trash size={16} /></button>
    </div>}
  </div>;
}

async function createCroppedAvatar(source, cropPixels) {
  const image = await new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(
    image,
    cropPixels.x,
    cropPixels.y,
    cropPixels.width,
    cropPixels.height,
    0,
    0,
    512,
    512,
  );
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Не удалось обработать фотографию")), "image/jpeg", 0.86);
  });
}

function AvatarCropDialog({ source, onCancel, onApply }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropPixels, setCropPixels] = useState(null);
  const [processing, setProcessing] = useState(false);

  async function applyCrop() {
    if (!cropPixels) return;
    setProcessing(true);
    try {
      const blob = await createCroppedAvatar(source, cropPixels);
      onApply(new File([blob], `doctor-avatar-${Date.now()}.jpg`, { type: "image/jpeg" }));
    } finally {
      setProcessing(false);
    }
  }

  return <div className="avatar-crop-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
    <section className="avatar-crop-dialog">
      <header><div><span>РЕДАКТОР ФОТОГРАФИИ</span><h3>Настройте аватар врача</h3></div>
        <button type="button" onClick={onCancel}><X size={20} /></button></header>
      <div className="avatar-crop-stage">
        <Cropper image={source} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid
          onCropChange={setCrop} onZoomChange={setZoom}
          onCropComplete={(_area, pixels) => setCropPixels(pixels)} />
      </div>
      <div className="avatar-crop-controls">
        <label><span>Масштаб</span><input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
        <small>Перетаскивайте фотографию мышью или пальцем. Светлая область попадёт в аватар 512×512.</small>
      </div>
      <footer><button type="button" className="secondary-button" onClick={onCancel}>Отмена</button>
        <button type="button" className="primary-button" disabled={processing || !cropPixels} onClick={applyCrop}>
          {processing ? "Обработка…" : "Обрезать и применить"}
        </button></footer>
    </section>
  </div>;
}

function DoctorEditor({ doctor, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({
    firstName: doctor?.firstName || "",
    lastName: doctor?.lastName || "",
    middleName: doctor?.middleName || "",
    specialty: doctor?.specialty || "",
    room: doctor?.room || "",
    phone: doctor?.phone || "",
    active: doctor?.active !== false,
    schedule: doctor?.schedule || [],
    workDates: doctor?.workDates || [],
  }));
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(doctor?.avatarUrl || "");
  const [cropSource, setCropSource] = useState("");

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }
  function toggleDay(weekday) {
    setForm((current) => {
      const exists = current.schedule.some((shift) => shift.weekday === weekday);
      return {
        ...current,
        schedule: exists
          ? current.schedule.filter((shift) => shift.weekday !== weekday)
          : [...current.schedule, { weekday, start: "09:00", end: "17:00" }],
      };
    });
  }
  function updateShift(weekday, field, value) {
    setForm((current) => ({
      ...current,
      schedule: current.schedule.map((shift) =>
        shift.weekday === weekday ? { ...shift, [field]: value } : shift),
    }));
  }
  function toggleWorkDate(date) {
    const key = localDateKey(date);
    setForm((current) => ({
      ...current,
      workDates: current.workDates.includes(key)
        ? current.workDates.filter((item) => item !== key)
        : [...current.workDates, key].sort(),
    }));
  }
  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setFormError("");
    try {
      const savedDoctor = await api(doctor ? `/api/doctors/${doctor.id}` : "/api/doctors", {
        method: doctor ? "PUT" : "POST",
        body: JSON.stringify({
          ...form,
          schedule: [...form.schedule].sort((a, b) => a.weekday - b.weekday),
        }),
      });
      if (avatarFile) {
        const avatarData = new FormData();
        avatarData.append("avatar", avatarFile);
        let telegramUserId = "";
        try { telegramUserId = JSON.parse(sessionStorage.getItem("backinfo-qr-user"))?.id || ""; } catch { /* no session */ }
        const avatarResponse = await fetch(`/api/doctors/${savedDoctor.id}/avatar`, {
          method: "POST",
          headers: telegramUserId ? { "x-telegram-user-id": telegramUserId } : {},
          body: avatarData,
        });
        const avatarResult = await avatarResponse.json();
        if (!avatarResponse.ok) throw new Error(avatarResult.error || "Не удалось загрузить фотографию");
      }
      onSaved(doctor ? "Данные врача обновлены" : "Врач добавлен");
    } catch (requestError) {
      setFormError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="doctor-editor" onSubmit={submit}>
      <div className="editor-header">
        <div><span>КАРТОЧКА ВРАЧА</span><h2>{doctor ? "Редактирование" : "Новый врач"}</h2></div>
        <button type="button" className="close-button" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="doctor-avatar-editor">
        <div>{avatarPreview ? <img src={avatarPreview} alt="Фото врача" /> : <Stethoscope size={34} weight="duotone" />}</div>
        <label><strong>Фотография врача</strong><span>JPG, PNG или WebP, до 8 МБ</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setCropSource(URL.createObjectURL(file));
            event.target.value = "";
          }} />
        </label>
      </div>
      <div className="form-grid">
        <label>Фамилия<input required value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} /></label>
        <label>Имя<input required value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} /></label>
        <label>Отчество<input value={form.middleName} onChange={(e) => setField("middleName", e.target.value)} /></label>
        <label>Специальность<input required value={form.specialty} onChange={(e) => setField("specialty", e.target.value)} /></label>
        <label>Кабинет<input value={form.room} onChange={(e) => setField("room", e.target.value)} /></label>
        <label>Телефон<input value={form.phone} onChange={(e) => setField("phone", e.target.value)} /></label>
      </div>
      <div className="schedule-editor">
        <div className="schedule-title"><strong>Рабочие дни</strong><span>Выберите дни и время приёма</span></div>
        {weekdays.map(([label, weekday]) => {
          const shift = form.schedule.find((item) => item.weekday === weekday);
          return <div className={`schedule-line ${shift ? "selected" : ""}`} key={weekday}>
            <button type="button" onClick={() => toggleDay(weekday)}>{label}</button>
            {shift ? <>
              <input type="time" value={shift.start} onChange={(e) => updateShift(weekday, "start", e.target.value)} />
              <span>—</span>
              <input type="time" value={shift.end} onChange={(e) => updateShift(weekday, "end", e.target.value)} />
            </> : <small>Выходной</small>}
          </div>;
        })}
      </div>
      <div className="doctor-calendar-editor">
        <div className="calendar-editor-header">
          <div><strong>Точные рабочие даты</strong><span>Если даты отмечены, они заменяют недельный шаблон</span></div>
          <div className="month-switcher">
            <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}><CaretLeft size={16} /></button>
            <b>{calendarMonth.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</b>
            <button type="button" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}><CaretRight size={16} /></button>
          </div>
        </div>
        <div className="mini-calendar-weekdays">{["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="mini-calendar-grid">
          {(() => {
            const first = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
            const offset = (first.getDay() + 6) % 7;
            return Array.from({ length: 42 }, (_, index) => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index - offset + 1));
          })().map((date) => {
            const key = localDateKey(date);
            return <button type="button" key={key}
              className={`${date.getMonth() !== calendarMonth.getMonth() ? "outside" : ""} ${form.workDates.includes(key) ? "working" : ""}`}
              onClick={() => toggleWorkDate(date)}>{date.getDate()}</button>;
          })}
        </div>
        {form.workDates.length > 0 && <button type="button" className="clear-exact-dates" onClick={() => setField("workDates", [])}>Очистить точные даты и использовать недельный шаблон</button>}
      </div>
      <label className="active-toggle"><input type="checkbox" checked={form.active} onChange={(e) => setField("active", e.target.checked)} /> Врач активен</label>
      {formError && <div className="form-error">{formError}</div>}
      <div className="editor-footer">
        <button type="button" className="secondary-button" onClick={onClose}>Отмена</button>
        <button type="submit" className="primary-button" disabled={saving}><FloppyDisk size={18} /> {saving ? "Сохранение…" : "Сохранить"}</button>
      </div>
      {cropSource && <AvatarCropDialog source={cropSource} onCancel={() => {
        URL.revokeObjectURL(cropSource);
        setCropSource("");
      }} onApply={(file) => {
        const preview = URL.createObjectURL(file);
        URL.revokeObjectURL(cropSource);
        setAvatarFile(file);
        setAvatarPreview(preview);
        setCropSource("");
      }} />}
    </form>
  </div>;
}

function UserRow({ user, onToggle, onRoleChange, busy, canManage }) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Без имени";
  const roleLabels = { owner: "Владелец", admin: "Администратор", user: "Пользователь" };
  return <div className="user-row">
    <div className="user-avatar">{name.slice(0, 1).toUpperCase()}</div>
    <div className="user-identity"><strong>{name}</strong><span>{user.username ? `@${user.username}` : `ID ${user.chatId}`}</span></div>
    <span className={`role role-${user.role}`}>{roleLabels[user.role] || roleLabels.user}</span>
    {canManage && user.role !== "owner" &&
      <select className="user-role-select" value={user.role || "user"} onChange={(event) => onRoleChange(user, event.target.value)}>
        <option value="user">Пользователь</option>
        <option value="admin">Администратор</option>
      </select>}
    {canManage && <span className={`access ${user.enabled ? "enabled" : "disabled"}`}>{user.enabled ? "Активен" : "Отключён"}</span>}
    {canManage && <button className={user.enabled ? "icon-action danger" : "icon-action allow"} disabled={busy || user.role === "owner"} onClick={() => onToggle(user)}>
      {user.enabled ? <UserMinus size={18} /> : <UserCheck size={18} />}{user.enabled ? "Отключить" : "Включить"}
    </button>}
  </div>;
}

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function AdministratorSection({ administrators, onChanged, setToast }) {
  const [selectedId, setSelectedId] = useState(administrators[0]?.id || "");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [showAdd, setShowAdd] = useState(false);
  const [newAdmin, setNewAdmin] = useState({ firstName: "", lastName: "", middleName: "", phone: "" });
  const [savingDate, setSavingDate] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [cropSource, setCropSource] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    if (!administrators.some((item) => item.id === selectedId)) {
      setSelectedId(administrators[0]?.id || "");
    }
  }, [administrators, selectedId]);

  const selected = administrators.find((item) => item.id === selectedId);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) =>
    new Date(month.getFullYear(), month.getMonth(), index - mondayOffset + 1));

  async function toggleDate(date) {
    if (!selected) return;
    const key = localDateKey(date);
    if (selected.workDates?.includes(key)) {
      setSelectedDate(key);
      return;
    }
    setSavingDate(key);
    const dates = new Set(selected.workDates || []);
    dates.add(key);
    const shifts = [
      ...(selected.workShifts || []),
      { date: key, start: "09:00", end: "18:00" },
    ];
    try {
      await api(`/api/administrators/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...selected, workDates: [...dates].sort(), workShifts: shifts }),
      });
      setSelectedDate(key);
      setToast("Рабочая смена добавлена");
      await onChanged();
    } catch (error) {
      setToast(error.message);
    } finally {
      setSavingDate("");
    }
  }

  async function updateSelectedShift(field, value) {
    if (!selected || !selectedDate) return;
    const shifts = (selected.workShifts || []).map((shift) =>
      shift.date === selectedDate ? { ...shift, [field]: value } : shift);
    try {
      await api(`/api/administrators/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...selected, workShifts: shifts }),
      });
      setToast("Время смены обновлено");
      await onChanged();
    } catch (error) { setToast(error.message); }
  }

  async function removeSelectedShift() {
    if (!selected || !selectedDate) return;
    const dates = (selected.workDates || []).filter((date) => date !== selectedDate);
    const shifts = (selected.workShifts || []).filter((shift) => shift.date !== selectedDate);
    try {
      await api(`/api/administrators/${selected.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...selected, workDates: dates, workShifts: shifts }),
      });
      setSelectedDate("");
      setToast("Рабочая смена удалена");
      await onChanged();
    } catch (error) { setToast(error.message); }
  }

  async function createAdministrator(event) {
    event.preventDefault();
    try {
      const created = await api("/api/administrators", {
        method: "POST",
        body: JSON.stringify({ ...newAdmin, active: true, workDates: [], workShifts: [] }),
      });
      setShowAdd(false);
      setNewAdmin({ firstName: "", lastName: "", middleName: "", phone: "" });
      setSelectedId(created.id);
      setToast("Администратор добавлен");
      await onChanged();
    } catch (error) { setToast(error.message); }
  }

  async function deleteAdministrator(administrator) {
    if (!window.confirm(`Удалить администратора ${administrator.lastName} ${administrator.firstName}?`)) return;
    try {
      await api(`/api/administrators/${administrator.id}`, { method: "DELETE" });
      setToast("Администратор удалён");
      await onChanged();
    } catch (error) { setToast(error.message); }
  }

  async function uploadAdministratorAvatar(file) {
    if (!selected) return;
    setUploadingAvatar(true);
    try {
      const data = new FormData();
      data.append("avatar", file);
      let telegramUserId = "";
      try { telegramUserId = JSON.parse(sessionStorage.getItem("backinfo-qr-user"))?.id || ""; } catch { /* no session */ }
      const response = await fetch(`/api/administrators/${selected.id}/avatar`, {
        method: "POST",
        headers: telegramUserId ? { "x-telegram-user-id": telegramUserId } : {},
        body: data,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось загрузить фотографию");
      setToast("Аватар администратора обновлён");
      await onChanged();
    } catch (error) {
      setToast(error.message);
    } finally {
      setUploadingAvatar(false);
    }
  }

  return <div className="admin-section">
    <div className="data-heading">
      <div><span>РАСПИСАНИЕ АДМИНИСТРАТОРОВ</span><h2>Рабочий календарь</h2></div>
      <div className="heading-actions"><b>{administrators.length} сотрудников</b><button onClick={() => setShowAdd(!showAdd)}><Plus size={17} /> Добавить</button></div>
    </div>
    {showAdd && <form className="admin-add-form" onSubmit={createAdministrator}>
      <input required placeholder="Фамилия" value={newAdmin.lastName} onChange={(e) => setNewAdmin({ ...newAdmin, lastName: e.target.value })} />
      <input required placeholder="Имя" value={newAdmin.firstName} onChange={(e) => setNewAdmin({ ...newAdmin, firstName: e.target.value })} />
      <input placeholder="Отчество" value={newAdmin.middleName} onChange={(e) => setNewAdmin({ ...newAdmin, middleName: e.target.value })} />
      <input placeholder="Телефон" value={newAdmin.phone} onChange={(e) => setNewAdmin({ ...newAdmin, phone: e.target.value })} />
      <button type="submit"><Plus size={16} /> Создать</button>
    </form>}
    <div className="admin-workspace">
      <aside className="admin-list">
        {administrators.map((administrator) => {
          const name = [administrator.lastName, administrator.firstName, administrator.middleName].filter(Boolean).join(" ");
          return <button className={`admin-card ${selectedId === administrator.id ? "selected" : ""}`} onClick={() => setSelectedId(administrator.id)} key={administrator.id}>
            <span className="admin-avatar">{administrator.avatarUrl
              ? <img src={administrator.avatarUrl} alt="" />
              : administrator.firstName.slice(0, 1)}</span>
            <span><strong>{name}</strong><small>{administrator.phone || "Телефон не указан"}</small></span>
            <i>{(administrator.workDates || []).filter((date) => date.startsWith(localDateKey(month).slice(0, 7))).length} дн.</i>
            <span className="admin-delete" onClick={(event) => { event.stopPropagation(); deleteAdministrator(administrator); }}><Trash size={15} /></span>
          </button>;
        })}
      </aside>
      <section className="calendar-panel">
        {selected && <div className="admin-profile-editor">
          <div className="admin-profile-avatar">{selected.avatarUrl
            ? <img src={selected.avatarUrl} alt="" />
            : <span>{[selected.lastName, selected.firstName].filter(Boolean).map((part) => part[0]).join("").slice(0, 2)}</span>}</div>
          <div><strong>{[selected.lastName, selected.firstName, selected.middleName].filter(Boolean).join(" ")}</strong>
            <small>JPG, PNG или WebP · обрезка 512×512</small></div>
          <label className="admin-avatar-button">
            <UploadSimple size={16} /> {uploadingAvatar ? "Загрузка…" : "Изменить фото"}
            <input disabled={uploadingAvatar} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setCropSource(URL.createObjectURL(file));
              event.target.value = "";
            }} />
          </label>
        </div>}
        <header>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><CaretLeft size={18} /></button>
          <div><CalendarBlank size={20} /><strong>{month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</strong></div>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><CaretRight size={18} /></button>
        </header>
        <div className="calendar-weekdays">{["ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС"].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {cells.map((date) => {
            const key = localDateKey(date);
            const outside = date.getMonth() !== month.getMonth();
            const working = selected?.workDates?.includes(key);
            const today = key === localDateKey(new Date());
            return <button
              disabled={!selected || savingDate === key}
              className={`${outside ? "outside" : ""} ${working ? "working" : ""} ${today ? "today" : ""} ${selectedDate === key ? "selected-shift" : ""}`}
              onClick={() => toggleDate(date)}
              key={key}
            ><span>{date.getDate()}</span>{working && <small>{selected.workShifts?.find((shift) => shift.date === key)?.start || "09:00"}</small>}</button>;
          })}
        </div>
        {selected && selectedDate && selected.workDates?.includes(selectedDate) && (() => {
          const shift = selected.workShifts?.find((item) => item.date === selectedDate) || { start: "09:00", end: "18:00" };
          return <div className="selected-shift-editor">
            <div><CalendarBlank size={17} /><span><small>Выбранная смена</small><strong>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short" })}</strong></span></div>
            <label>Начало<input type="time" value={shift.start} onChange={(event) => updateSelectedShift("start", event.target.value)} /></label>
            <label>Окончание<input type="time" value={shift.end} onChange={(event) => updateSelectedShift("end", event.target.value)} /></label>
            <button onClick={removeSelectedShift}><Trash size={15} /> Удалить смену</button>
          </div>;
        })()}
        <footer><span><i className="legend-work" /> Рабочий день</span><span><i className="legend-today" /> Сегодня</span><strong>{selected ? "Нажмите на дату, чтобы изменить график" : "Выберите администратора"}</strong></footer>
      </section>
    </div>
    {cropSource && <AvatarCropDialog source={cropSource} onCancel={() => {
      URL.revokeObjectURL(cropSource);
      setCropSource("");
    }} onApply={(file) => {
      URL.revokeObjectURL(cropSource);
      setCropSource("");
      void uploadAdministratorAvatar(file);
    }} />}
  </div>;
}

function ScheduleOverview({ doctors, administrators, administratorsOnly = false }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const daysCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cellWidth = administratorsOnly ? 54 : 28;
  const dates = Array.from({ length: daysCount }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1));
  const rows = [
    ...doctors.map((person) => ({ ...person, personType: "Врач", name: [person.lastName, person.firstName].filter(Boolean).join(" ") })),
    ...administrators.map((person) => ({ ...person, personType: "Администратор", name: [person.lastName, person.firstName].filter(Boolean).join(" ") })),
  ];
  function isWorking(person, date) {
    const key = localDateKey(date);
    if (person.personType === "Администратор") return person.workDates?.includes(key);
    if (person.workDates?.length) return person.workDates.includes(key);
    return person.schedule?.some((shift) => shift.weekday === date.getDay());
  }

  return <div className="schedule-overview">
    <div className="data-heading">
      <div><span>{administratorsOnly ? "ГРАФИК АДМИНИСТРАТОРОВ" : "СВОДНЫЙ ГРАФИК"}</span><h2>{administratorsOnly ? "Смены администраторов" : "Врачи и администраторы"}</h2></div>
      <div className="schedule-month-nav">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><CaretLeft size={17} /></button>
        <b>{month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</b>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><CaretRight size={17} /></button>
      </div>
    </div>
    <div className="schedule-matrix">
      <div className="matrix-row matrix-header" style={{ gridTemplateColumns: `190px repeat(${daysCount}, ${cellWidth}px)` }}>
        <span>Сотрудник</span>{dates.map((date) => <span className={date.getDay() === 0 || date.getDay() === 6 ? "weekend" : ""} key={localDateKey(date)}><b>{date.getDate()}</b><small>{["ВС","ПН","ВТ","СР","ЧТ","ПТ","СБ"][date.getDay()]}</small></span>)}
      </div>
      {rows.map((person) => <div className="matrix-row" style={{ gridTemplateColumns: `190px repeat(${daysCount}, ${cellWidth}px)` }} key={`${person.personType}-${person.id}`}>
        <span className="matrix-person"><strong>{person.name}</strong><small>{person.personType}</small></span>
        {dates.map((date) => {
          const key = localDateKey(date);
          const shift = person.workShifts?.find((item) => item.date === key);
          return <span className={`matrix-day ${date.getDay() === 0 || date.getDay() === 6 ? "weekend" : ""} ${isWorking(person, date) ? "working" : ""}`} title={`${person.name}: ${date.toLocaleDateString("ru-RU")}${shift ? ` ${shift.start}–${shift.end}` : ""}`} key={key}>
            {isWorking(person, date) ? (administratorsOnly ? <><b>{shift?.start || "09:00"}</b><small>{shift?.end || "18:00"}</small></> : "●") : ""}
          </span>;
        })}
      </div>)}
    </div>
    <div className="matrix-legend"><span><i className="doctor-legend" /> Рабочая смена</span><span><i className="weekend-legend" /> Выходной календаря</span></div>
  </div>;
}

function AdministratorDashboard({ administrators }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const monthKey = localDateKey(month).slice(0, 7);
  const todayKey = localDateKey(new Date());
  const activeAdministrators = administrators.filter((person) => person.active !== false);
  const workingToday = activeAdministrators.filter((person) => person.workDates?.includes(todayKey));

  function hoursBetween(start = "09:00", end = "18:00") {
    const [startHour, startMinute] = start.split(":").map(Number);
    const [endHour, endMinute] = end.split(":").map(Number);
    return Math.max(0, (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60);
  }

  const rows = activeAdministrators.map((person) => {
    const dates = (person.workDates || []).filter((date) => date.startsWith(monthKey));
    const hours = dates.reduce((sum, date) => {
      const shift = person.workShifts?.find((item) => item.date === date);
      return sum + hoursBetween(shift?.start, shift?.end);
    }, 0);
    return {
      ...person,
      name: [person.lastName, person.firstName, person.middleName].filter(Boolean).join(" "),
      days: dates.length,
      hours,
    };
  }).sort((a, b) => b.days - a.days);

  const totalShifts = rows.reduce((sum, person) => sum + person.days, 0);
  const totalHours = rows.reduce((sum, person) => sum + person.hours, 0);

  return <div className="admin-dashboard">
    <div className="data-heading">
      <div><span>DASHBOARD АДМИНИСТРАТОРОВ</span><h2>Работа администраторов</h2></div>
      <div className="schedule-month-nav">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><CaretLeft size={17} /></button>
        <b>{month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</b>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><CaretRight size={17} /></button>
      </div>
    </div>
    <div className="admin-dashboard-stats">
      <StatCard icon={UserGear} label="Администраторов" value={activeAdministrators.length} detail="активных сотрудников" />
      <StatCard icon={UserCheck} label="Сегодня работают" value={workingToday.length} detail="дежурных сегодня" tone="green" />
      <StatCard icon={CalendarBlank} label="Смен за месяц" value={totalShifts} detail="по календарю" tone="purple" />
      <StatCard icon={Clock} label="Часов за месяц" value={totalHours.toFixed(1)} detail="суммарная нагрузка" tone="cyan" />
    </div>
    <div className="admin-dashboard-grid">
      <section className="admin-duty-panel">
        <div className="panel-title"><span>ДЕЖУРНЫЕ СЕГОДНЯ</span><strong>{new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</strong></div>
        {workingToday.map((person) => {
          const shift = person.workShifts?.find((item) => item.date === todayKey);
          return <div className="admin-duty-row" key={person.id}>
            <i><UserGear size={18} /></i>
            <span><strong>{[person.lastName, person.firstName].filter(Boolean).join(" ")}</strong><small>{shift?.start || "09:00"} — {shift?.end || "18:00"}</small></span>
            <b>НА СМЕНЕ</b>
          </div>;
        })}
        {!workingToday.length && <div className="workload-empty">На сегодня дежурные не назначены</div>}
      </section>
      <section className="admin-load-panel">
        <div className="panel-title"><span>ЗАГРУЗКА ЗА МЕСЯЦ</span><strong>Шкала 31 день</strong></div>
        {rows.map((person) => <div className="admin-load-row" key={person.id}>
          <span><strong>{person.name}</strong><small>{person.days} смен · {person.hours.toFixed(1)} ч.</small></span>
          <div><i style={{ width: `${Math.min(100, person.days / 31 * 100)}%` }} /></div>
          <b>{person.days}/31</b>
        </div>)}
        {!rows.length && <div className="workload-empty">Администраторы пока не добавлены</div>}
      </section>
    </div>
  </div>;
}

function MediaLibrary({ canManage, setToast, uploadOnly = false }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [directory, setDirectory] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const loadMedia = useCallback(async () => {
    try {
      const result = await api("/api/media");
      setFiles(result.files || []);
      setDirectory(result.directory || "");
    } catch (requestError) {
      setToast(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [setToast]);

  useEffect(() => { loadMedia(); }, [loadMedia]);

  function uploadFiles(selectedFiles) {
    const selected = [...selectedFiles].filter((file) => file.type.startsWith("video/") || file.type.startsWith("image/"));
    if (!selected.length || !canManage) return;
    const form = new FormData();
    selected.forEach((file) => form.append("files", file));
    const request = new XMLHttpRequest();
    request.open("POST", "/api/media/upload");
    try {
      const userId = JSON.parse(sessionStorage.getItem("backinfo-qr-user"))?.id;
      if (userId) request.setRequestHeader("x-telegram-user-id", userId);
    } catch { /* no session */ }
    setUploading(true);
    setProgress(0);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) setProgress(Math.round(event.loaded / event.total * 100));
    };
    request.onload = () => {
      setUploading(false);
      if (request.status >= 200 && request.status < 300) {
        const result = JSON.parse(request.responseText);
        setFiles(result.files || []);
        setToast(`Загружено файлов: ${result.uploaded?.length || selected.length}`);
      } else {
        try { setToast(JSON.parse(request.responseText).error || "Ошибка загрузки"); }
        catch { setToast("Ошибка загрузки файлов"); }
      }
    };
    request.onerror = () => { setUploading(false); setToast("Соединение с сервером прервано"); };
    request.send(form);
  }

  async function deleteMedia(file) {
    if (!window.confirm(`Удалить файл «${file.name}»?`)) return;
    const result = await api(`/api/media/${encodeURIComponent(file.name)}`, { method: "DELETE" });
    setFiles(result.files || []);
    setToast("Файл удалён");
  }

  async function moveMedia(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= files.length) return;
    const reordered = [...files];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setFiles(reordered);
    try {
      const result = await api("/api/media/order", {
        method: "PUT",
        body: JSON.stringify({ files: reordered.map((file) => file.name) }),
      });
      setFiles(result.files || reordered);
    } catch (requestError) {
      setToast(requestError.message);
      loadMedia();
    }
  }

  function formatSize(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
  }

  return <div className="media-library">
    <div className="data-heading">
      <div><span>MEDIA STUDIO</span><h2>{uploadOnly ? "Загрузка файлов" : "Медиатека Electron"}</h2></div>
      <div className="heading-actions"><b>{files.length} файлов</b>{canManage &&
        <button onClick={() => inputRef.current?.click()}><UploadSimple size={17} /> Загрузить</button>}</div>
    </div>
    <input ref={inputRef} hidden type="file" multiple accept="video/*,image/*" onChange={(event) => uploadFiles(event.target.files)} />
    {canManage && (uploadOnly || !files.length) && <div className={`media-dropzone ${dragging ? "dragging" : ""}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); uploadFiles(event.dataTransfer.files); }}
      onClick={() => !uploading && inputRef.current?.click()}>
      <UploadSimple size={32} weight="duotone" />
      <div><strong>{uploading ? `Загрузка ${progress}%` : "Перетащите фото или видео сюда"}</strong>
        <small>{uploading ? "Не закрывайте страницу до завершения" : "или нажмите, чтобы выбрать до 20 файлов"}</small></div>
      {uploading && <div className="media-upload-progress"><i style={{ width: `${progress}%` }} /></div>}
    </div>}
    <div className="media-location"><FilmStrip size={16} /><span>Папка воспроизведения:</span><code>{directory || "backelectron/original"}</code></div>
    {loading ? <div className="loading-state">Загружаем медиатеку…</div> :
      <div className="media-grid">
        {files.map((file, index) => <article className="media-card" key={file.name}>
          <div className="media-preview">
            {file.type === "video"
              ? <video src={file.url} muted preload="metadata" />
              : <img src={file.url} alt={file.name} loading="lazy" />}
            <span>{file.type === "video" ? <FilmStrip size={15} /> : <ImageSquare size={15} />}{file.type === "video" ? "Видео" : "Фото"}</span>
            <b>{String(index + 1).padStart(2, "0")}</b>
          </div>
          <div className="media-card-body"><strong title={file.name}>{file.name}</strong>
            <small>{formatSize(file.size)} · {new Date(file.updatedAt).toLocaleDateString("ru-RU")}</small></div>
          {canManage && <div className="media-card-actions">
            <button disabled={index === 0} onClick={() => moveMedia(index, -1)} title="Переместить выше"><ArrowUp size={16} /></button>
            <button disabled={index === files.length - 1} onClick={() => moveMedia(index, 1)} title="Переместить ниже"><ArrowDown size={16} /></button>
            <button className="delete" onClick={() => deleteMedia(file)} title="Удалить"><Trash size={16} /></button>
          </div>}
        </article>)}
        {!files.length && <div className="media-empty"><FilmStrip size={42} /><strong>Медиатека пуста</strong><span>Загрузите первое видео или изображение</span></div>}
      </div>}
  </div>;
}

function MonthlyWorkload({ doctors, administrators }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1));

  function shiftHours(start = "09:00", end = "18:00") {
    const [startHour, startMinute] = start.split(":").map(Number);
    const [endHour, endMinute] = end.split(":").map(Number);
    return Math.max(0, (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60);
  }

  const people = [
    ...doctors.map((person) => ({ ...person, personType: "Врач" })),
    ...administrators.map((person) => ({ ...person, personType: "Администратор" })),
  ].map((person) => {
    let hours = 0;
    let workingDays = 0;
    dates.forEach((date) => {
      const key = localDateKey(date);
      if (person.personType === "Администратор") {
        if (!person.workDates?.includes(key)) return;
        const shift = person.workShifts?.find((item) => item.date === key);
        workingDays += 1;
        hours += shiftHours(shift?.start, shift?.end);
        return;
      }
      const exactDatesUsed = (person.workDates || []).length > 0;
      const weeklyShift = person.schedule?.find((item) => item.weekday === date.getDay());
      if ((exactDatesUsed && person.workDates.includes(key)) || (!exactDatesUsed && weeklyShift)) {
        const exactShift = person.workShifts?.find((item) => item.date === key);
        workingDays += 1;
        hours += shiftHours(exactShift?.start || weeklyShift?.start, exactShift?.end || weeklyShift?.end);
      }
    });
    return {
      ...person,
      name: [person.lastName, person.firstName, person.middleName].filter(Boolean).join(" "),
      workingDays,
      hours,
      percent: Math.min(100, (workingDays / 31) * 100),
    };
  }).sort((a, b) => b.workingDays - a.workingDays || b.hours - a.hours);

  const totalDays = people.reduce((sum, person) => sum + person.workingDays, 0);
  const totalHours = people.reduce((sum, person) => sum + person.hours, 0);

  return <div className="monthly-workload">
    <div className="data-heading">
      <div><span>МЕСЯЧНАЯ ЗАГРУЗКА</span><h2>Сколько работает каждый сотрудник</h2></div>
      <div className="schedule-month-nav">
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><CaretLeft size={17} /></button>
        <b>{month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</b>
        <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><CaretRight size={17} /></button>
      </div>
    </div>
    <div className="workload-summary">
      <article><small>СОТРУДНИКОВ</small><strong>{people.length}</strong></article>
      <article><small>ВСЕГО СМЕН</small><strong>{totalDays}</strong></article>
      <article><small>ВСЕГО ЧАСОВ</small><strong>{totalHours.toFixed(1)}</strong></article>
      <article><small>ШКАЛА</small><strong>31 день</strong></article>
    </div>
    <div className="workload-list">
      <div className="workload-head"><span>Сотрудник</span><span>Нагрузка за месяц</span><span>Смены</span><span>Часы</span></div>
      {people.map((person) => <div className="workload-row" key={`${person.personType}-${person.id}`}>
        <div className="workload-person">
          <i className={person.personType === "Врач" ? "doctor" : "administrator"}>{person.personType === "Врач" ? "В" : "А"}</i>
          <span><strong>{person.name}</strong><small>{person.personType}{person.specialty ? ` · ${person.specialty}` : ""}</small></span>
        </div>
        <div className="workload-scale">
          <div><i style={{ width: `${person.percent}%` }} /></div>
          <small>{person.workingDays} из 31 дней · {person.percent.toFixed(0)}%</small>
        </div>
        <strong className="workload-number">{person.workingDays}</strong>
        <strong className="workload-number">{person.hours.toFixed(1)}</strong>
      </div>)}
      {!people.length && <div className="workload-empty">Сотрудники пока не добавлены</div>}
    </div>
  </div>;
}

export function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [adminActiveTab, setAdminActiveTab] = useState("adminDashboard");
  const [mediaActiveTab, setMediaActiveTab] = useState("mediaLibrary");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboardMode, setDashboardMode] = useState(() => {
    if (window.location.pathname === "/admin-dashboard") return "admin";
    if (window.location.pathname === "/media-dashboard") return "media";
    return "main";
  });
  const [data, setData] = useState({ doctors: [], administrators: [], telegramUsers: [], commands: [], display: { theme: "dark" } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busyUser, setBusyUser] = useState("");
  const [editingDoctor, setEditingDoctor] = useState(undefined);
  const [theme, setTheme] = useState(() => localStorage.getItem("backinfo-theme") || "dark");
  const [authenticatedUser, setAuthenticatedUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem("backinfo-qr-user")) || null; }
    catch { return null; }
  });
  const currentUser = authenticatedUser
    ? [authenticatedUser.firstName, authenticatedUser.lastName].filter(Boolean).join(" ") || `@${authenticatedUser.username || authenticatedUser.id}`
    : "";
  const canManageDoctors = ["owner", "admin"].includes(authenticatedUser?.role);

  function toggleTheme() {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("backinfo-theme", next);
      return next;
    });
  }

  const approveAccess = useCallback((telegramUser) => {
    sessionStorage.setItem("backinfo-qr-user", JSON.stringify(telegramUser));
    setAuthenticatedUser(telegramUser);
  }, []);

  function changeUser() {
    sessionStorage.removeItem("backinfo-qr-user");
    setAuthenticatedUser(null);
  }

  const loadData = useCallback(async () => {
    try { setData(await api("/api/admin/overview")); setError(""); }
    catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); const interval = setInterval(loadData, 10000); return () => clearInterval(interval); }, [loadData]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(""), 3000); return () => clearTimeout(timeout); }, [toast]);

  const metrics = useMemo(() => ({
    activeDoctors: data.doctors.filter((doctor) => doctor.active).length,
    enabledUsers: data.telegramUsers.filter((user) => user.enabled).length,
  }), [data]);

  async function runAction(path, message, body, method = "POST") {
    try {
      await api(path, { method, body: body ? JSON.stringify(body) : undefined });
      setToast(message); await loadData();
    } catch (actionError) { setToast(actionError.message); }
  }
  async function toggleUser(user) {
    setBusyUser(user.chatId);
    await runAction(`/api/admin/users/${user.chatId}/${user.enabled ? "disable" : "enable"}`,
      user.enabled ? "Доступ пользователя отключён" : "Доступ пользователя разрешён");
    setBusyUser("");
  }
  async function changeUserRole(user, role) {
    setBusyUser(user.chatId);
    await runAction(`/api/admin/users/${user.chatId}/role`,
      role === "admin" ? "Пользователь назначен администратором" : "Установлена роль пользователя",
      { role });
    setBusyUser("");
  }
  async function deleteDoctor(doctor) {
    const name = [doctor.lastName, doctor.firstName].filter(Boolean).join(" ");
    if (!window.confirm(`Удалить врача ${name}?`)) return;
    await runAction(`/api/doctors/${doctor.id}`, "Врач удалён", undefined, "DELETE");
  }
  async function doctorSaved(message) {
    setEditingDoctor(undefined);
    setToast(message);
    await loadData();
  }
  const visibleMediaNavItems = canManageDoctors
    ? mediaNavItems
    : mediaNavItems.filter((item) => item.id !== "displaySettings");
  const visibleNavItems = dashboardMode === "admin"
    ? administratorNavItems
    : dashboardMode === "media"
      ? visibleMediaNavItems
      : mainNavItems;
  const visibleTab = dashboardMode === "admin" ? adminActiveTab : dashboardMode === "media" ? mediaActiveTab : activeTab;
  const pageTitle = visibleNavItems.find((item) => item.id === visibleTab)?.label;

  const switchDashboard = useCallback((mode) => {
    setDashboardMode(mode);
    setMobileMenuOpen(false);
    if (mode === "media") setMediaActiveTab("mediaLibrary");
    const path = mode === "admin" ? "/admin-dashboard" : mode === "media" ? "/media-dashboard" : "/";
    window.history.pushState({ dashboardMode: mode }, "", path);
  }, []);

  useEffect(() => {
    const handleNavigation = () => {
      if (window.location.pathname === "/admin-dashboard") setDashboardMode("admin");
      else if (window.location.pathname === "/media-dashboard") setDashboardMode("media");
      else setDashboardMode("main");
    };
    window.addEventListener("popstate", handleNavigation);
    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);

  if (!authenticatedUser) {
    return <AccessGate onApproved={approveAccess} />;
  }

  return <main className={`dashboard-shell theme-${theme}`}>
    <header className="topbar">
      <button className="burger-button" onClick={() => setMobileMenuOpen((open) => !open)} aria-label="Открыть меню" aria-expanded={mobileMenuOpen}>
        {mobileMenuOpen ? <X size={22} /> : <List size={22} />}
      </button>
      <div className="brand-logo-wrap">
        <img className="apollo-logo" src="/assets/neonmate-plus-logo.png" alt="NeonMate Plus" />
        <span>MEDICAL DISPLAY CONTROL</span>
      </div>
      <div className="system-pill"><WifiHigh size={16} /> BACKEND ONLINE</div>
      <div className="dashboard-slider" title="Переключить dashboard">
        <button className={dashboardMode === "main" ? "active" : ""} onClick={() => switchDashboard("main")}>Общий</button>
        <button className={dashboardMode === "admin" ? "active" : ""} onClick={() => switchDashboard("admin")}>Админы</button>
        <button className={dashboardMode === "media" ? "active" : ""} onClick={() => switchDashboard("media")}>Медиа</button>
      </div>
      <button className="theme-switch" onClick={toggleTheme} aria-label="Сменить тему" title={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}>
        <Sun size={15} weight="fill" />
        <span className={theme === "light" ? "light" : ""}><i /></span>
        <MoonStars size={15} weight="fill" />
      </button>
      <button className="current-user" onClick={changeUser} title="Сменить пользователя">
        <IdentificationBadge size={17} weight="duotone" />
        <span><small>ПОЛЬЗОВАТЕЛЬ</small><strong>{currentUser}</strong></span>
      </button>
      <div className="topbar-time"><span>{new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long" })}</span>
        <strong>{new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</strong></div>
    </header>

    <div className="dashboard-grid">
      {mobileMenuOpen && <button className="mobile-menu-backdrop" aria-label="Закрыть меню" onClick={() => setMobileMenuOpen(false)} />}
      <aside className={`side-nav ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="side-label">{dashboardMode === "admin" ? "АДМИН-ПАНЕЛЬ" : dashboardMode === "media" ? "MEDIA STUDIO" : "МОДУЛИ СИСТЕМЫ"}</div>
        {visibleNavItems.map(({ id, label, icon: Icon, meta }) => <button key={id} className={`nav-card ${visibleTab === id ? "active" : ""}`} onClick={() => {
          if (dashboardMode === "admin") setAdminActiveTab(id);
          else if (dashboardMode === "media") setMediaActiveTab(id);
          else setActiveTab(id);
          setMobileMenuOpen(false);
        }}>
          <Icon size={30} weight="duotone" /><span><strong>{label}</strong><small>{meta}</small></span>
        </button>)}
        <div className="connection-card"><Broadcast size={24} weight="duotone" /><div><strong>Electron</strong><span>Экран подключён</span></div><i /></div>
      </aside>

      <section className="control-frame">
        <div className="frame-header"><div><span className="section-kicker">ЦЕНТР УПРАВЛЕНИЯ</span><h1>{pageTitle}</h1></div>
          <button className="refresh-button" onClick={loadData}><Activity size={17} /> Обновить</button></div>
        {error && <div className="error-banner">Backend недоступен: {error}</div>}
        {loading ? <div className="loading-state">Синхронизация системы…</div> : <>
          {dashboardMode === "main" && activeTab === "overview" && <div className="overview-layout">
            <div className="stats-grid">
              <StatCard icon={Stethoscope} label="Всего врачей" value={data.doctors.length} detail={`${metrics.activeDoctors} активны`} />
              <StatCard icon={TelegramLogo} label="Пользователи бота" value={data.telegramUsers.length} detail={`${metrics.enabledUsers} с доступом`} tone="violet" />
              <StatCard icon={Command} label="Команды" value={data.commands.length} detail="готовы к запуску" tone="cyan" />
              <StatCard icon={ShieldCheck} label="Статус системы" value="100%" detail="все сервисы доступны" tone="green" />
            </div>
            <div className="overview-panels">
              <article className="panel chart-panel">
                <div className="panel-title"><div><span>АКТИВНОСТЬ</span><strong>Запросы системы</strong></div><Clock size={20} /></div>
                <ResponsiveContainer width="100%" height={170}><AreaChart data={activityData}>
                  <defs><linearGradient id="requestsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#18a8ff" stopOpacity={0.55} /><stop offset="100%" stopColor="#18a8ff" stopOpacity={0} /></linearGradient>
                    <linearGradient id="telegramFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} /><stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke="#16375e" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="time" stroke="#5d7897" tickLine={false} axisLine={false} />
                  <YAxis stroke="#5d7897" tickLine={false} axisLine={false} /><Tooltip contentStyle={{ background: "#06152b", border: "1px solid #1a5b91", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="requests" stroke="#22b5ff" fill="url(#requestsFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="telegram" stroke="#9d75ff" fill="url(#telegramFill)" strokeWidth={2} />
                </AreaChart></ResponsiveContainer>
              </article>
              <article className="panel command-center">
                <div className="panel-title"><div><span>БЫСТРЫЕ КОМАНДЫ</span><strong>Управление экраном</strong></div><Desktop size={20} /></div>
                <button onClick={() => runAction("/api/admin/display/show", "Табло врачей показано")}><BellRinging size={24} weight="duotone" /><span><strong>Показать врачей</strong><small>Открыть табло сейчас</small></span></button>
                <button onClick={() => runAction("/api/admin/display/theme", "Включена светлая тема", { theme: "light" })}><Sun size={24} weight="duotone" /><span><strong>Светлая тема</strong><small>Матовое светлое табло</small></span></button>
                <button onClick={() => runAction("/api/admin/display/theme", "Включена тёмная тема", { theme: "dark" })}><MoonStars size={24} weight="duotone" /><span><strong>Тёмная тема</strong><small>Контрастный ночной режим</small></span></button>
              </article>
            </div>
            <article className="system-strip">
              <div><WifiHigh size={22} /><span><small>BACKEND</small><strong>ONLINE</strong></span></div>
              <div><TelegramLogo size={22} /><span><small>TELEGRAM</small><strong>CONNECTED</strong></span></div>
              <div><Desktop size={22} /><span><small>DISPLAY</small><strong>{data.display.theme?.toUpperCase()}</strong></span></div>
              <div><ShieldCheck size={22} /><span><small>SECURITY</small><strong>OWNER CONTROL</strong></span></div>
            </article>
          </div>}

          {dashboardMode === "admin" && adminActiveTab === "adminDashboard" && <AdministratorDashboard administrators={data.administrators || []} />}

          {dashboardMode === "main" && activeTab === "doctors" && <div className="data-section">
            <div className="data-heading"><div><span>МЕДИЦИНСКИЙ ПЕРСОНАЛ</span><h2>Список врачей</h2></div>
              <div className="heading-actions"><b>{data.doctors.length} записей</b>{canManageDoctors && <button onClick={() => setEditingDoctor(null)}><Plus size={17} /> Добавить врача</button>}</div></div>
            <div className="data-table">{data.doctors.map((doctor) =>
              <DoctorRow doctor={doctor} onEdit={setEditingDoctor} onDelete={deleteDoctor} canManage={canManageDoctors} key={doctor.id} />)}</div>
          </div>}

          {dashboardMode === "admin" && adminActiveTab === "users" && <div className="data-section">
            <div className="data-heading"><div><span>TELEGRAM USERS</span><h2>Пользователи бота</h2></div><b>{data.telegramUsers.length} пользователей</b></div>
            <div className="data-table">{data.telegramUsers.length ? data.telegramUsers.map((user) =>
              <UserRow user={user} onToggle={toggleUser} onRoleChange={changeUserRole} canManage={authenticatedUser?.role === "owner"} busy={busyUser === user.chatId} key={user.chatId} />)
              : <div className="empty-table">Пользователи появятся после команды /start в Telegram.</div>}</div>
          </div>}

          {dashboardMode === "admin" && adminActiveTab === "administrators" && <AdministratorSection administrators={data.administrators || []} onChanged={loadData} setToast={setToast} />}

          {dashboardMode === "main" && activeTab === "schedules" && <ScheduleOverview doctors={data.doctors} administrators={data.administrators || []} />}

          {dashboardMode === "admin" && adminActiveTab === "adminSchedules" && <ScheduleOverview doctors={[]} administrators={data.administrators || []} administratorsOnly />}

          {dashboardMode === "main" && activeTab === "monthlyLoad" && <MonthlyWorkload doctors={data.doctors} administrators={data.administrators || []} />}

          {dashboardMode === "media" && mediaActiveTab === "mediaLibrary" && <MediaLibrary canManage={["owner", "admin"].includes(authenticatedUser?.role)} setToast={setToast} />}

          {dashboardMode === "media" && mediaActiveTab === "mediaUpload" && <MediaLibrary uploadOnly canManage={["owner", "admin"].includes(authenticatedUser?.role)} setToast={setToast} />}

          {dashboardMode === "media" && mediaActiveTab === "displaySettings" && canManageDoctors &&
            <DisplaySettings display={data.display || {}} onSaved={loadData} setToast={setToast} />}

          {dashboardMode === "admin" && adminActiveTab === "adminLoad" && <MonthlyWorkload doctors={[]} administrators={data.administrators || []} />}

          {dashboardMode === "main" && activeTab === "commands" && <div className="data-section">
            <div className="data-heading"><div><span>BOT COMMAND LIBRARY</span><h2>Команды Telegram</h2></div><b>{data.commands.length} команд</b></div>
            <div className="commands-grid">{data.commands.map((item, index) => <article className="command-card" key={item.command}>
              <div className="command-index">{String(index + 1).padStart(2, "0")}</div><PaperPlaneTilt size={24} weight="duotone" />
              <code>{item.command}</code><p>{item.description}</p>
            </article>)}</div>
          </div>}
        </>}
      </section>

      <aside className="right-rail">
        <div className="rail-title">LIVE STATUS</div>
        <article className="rail-card"><Stethoscope size={24} /><span><small>ВРАЧИ</small><strong>{metrics.activeDoctors}/{data.doctors.length}</strong></span><i /></article>
        <article className="rail-card"><UsersThree size={24} /><span><small>ДОСТУПЫ</small><strong>{metrics.enabledUsers}</strong></span><i /></article>
        <article className="rail-card"><UserGear size={24} /><span><small>АДМИНИСТРАТОРЫ</small><strong>{data.administrators?.length || 0}</strong></span><i /></article>
        <article className="rail-card"><Command size={24} /><span><small>КОМАНДЫ</small><strong>{data.commands.length}</strong></span><i /></article>
        <article className="event-feed"><div className="panel-title"><div><span>СОБЫТИЯ</span><strong>Последние действия</strong></div></div>
          <p><i /> Backend синхронизирован <time>сейчас</time></p><p><i /> Telegram-бот подключён <time>online</time></p>
          <p><i /> Electron-тема: {data.display.theme} <time>active</time></p></article>
      </aside>
    </div>
    {toast && <div className="toast"><CheckCircle size={20} weight="fill" /> {toast}</div>}
    {editingDoctor !== undefined && <DoctorEditor doctor={editingDoctor} onClose={() => setEditingDoctor(undefined)} onSaved={doctorSaved} />}
  </main>;
}
