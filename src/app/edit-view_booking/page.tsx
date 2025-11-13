"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, Dispatch, SetStateAction, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal } from "react";

{/*Gets all bookings for the calender*/}
function getBookingsForDate(dateStr: string, bookings: any[], vehicles: any[], categoryFilter: 'ALL' | 'XLT' | 'PRO', searchTerm: string) {
  const lowerSearch = searchTerm.toLowerCase();
  return bookings.filter(b => {
    const start = new Date(b.start_date);
    const end = new Date(b.end_date);
    const d = new Date(dateStr);

    const vehicle = vehicles.find(v => v.vehicle_id === b.vehicle_id);
    if (!vehicle) return false;
    if (categoryFilter !== 'ALL' && !vehicle.trim.includes(categoryFilter)) return false;
    if (searchTerm && !b.name.toLowerCase().includes(lowerSearch)) return false;

    return d >= start && d <= end;
  });
}

{/*Gets all booked dates for the vehicles*/}
function getAllBookedDates(year: number, bookings: any[], vehicles: any[], categoryFilter: 'ALL' | 'XLT' | 'PRO', searchTerm: string) {
  const bookedDates = new Set<string>();
  const lowerSearch = searchTerm.toLowerCase();

  bookings.forEach(b => {
    const vehicle = vehicles.find(v => v.vehicle_id === b.vehicle_id);
    if (!vehicle) return;
    if (categoryFilter !== 'ALL' && !vehicle.trim.includes(categoryFilter)) return;
    if (searchTerm && !b.name.toLowerCase().includes(lowerSearch)) return;

    let current = new Date(b.start_date);
    const end = new Date(b.end_date);
    while (current <= end) {
      if (current.getFullYear() === year) {
        bookedDates.add(current.toISOString().slice(0, 10));
      }
      current.setDate(current.getDate() + 1);
    }
  });
  return bookedDates;
}

// --- EditBookingModal ---
function EditBookingModal({
  booking,
  vehicle,
  bookings,
  onClose,
  onSave,
}: {
  booking: any;
  vehicle: any;
  bookings: any[];
  onClose: () => void;
  onSave: (updatedBooking: any) => void;
}) {
  const year = new Date().getFullYear();
  const [form, setForm] = useState({
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
  });
  const [selectedDates, setSelectedDates] = useState<string[]>([booking.start_date, booking.end_date]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 🆕 Delete state
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    try {
      setDeleting(true);
      const res = await fetch(`/api/bookings/${booking.booking_id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete booking");
      setDeleting(false);
      setShowConfirmDelete(false);
      onClose();
      window.location.reload();
    } catch (err) {
      console.error(err);
      setDeleting(false);
    }
  }

  const bookedDates = new Set<string>();
  bookings.forEach(b => {
    if (b.vehicle_id === vehicle.vehicle_id && b.booking_id !== booking.booking_id) {
      let current = new Date(b.start_date);
      const end = new Date(b.end_date);
      while (current <= end) {
        bookedDates.add(current.toISOString().slice(0, 10));
        current.setDate(current.getDate() + 1);
      }
    }
  });

  function handleDateClick(dateStr: string) {
    if (bookedDates.has(dateStr)) return;
    if (selectedDates.length === 0 || selectedDates.length === 2) {
      setSelectedDates([dateStr]);
    } else if (selectedDates.length === 1) {
      const [first] = selectedDates;
      if (first === dateStr) return;
      const range = first < dateStr ? [first, dateStr] : [dateStr, first];

      let current = new Date(range[0]);
      const end = new Date(range[1]);
      let valid = true;
      while (current <= end) {
        if (bookedDates.has(current.toISOString().slice(0, 10))) {
          valid = false;
          break;
        }
        current.setDate(current.getDate() + 1);
      }

      if (!valid) {
        setError("Selected range includes booked dates.");
        setTimeout(() => setError(null), 2000);
        return;
      }

      setSelectedDates(range);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSave() {
    if (!form.name || !form.email || !form.phone) {
      setError("Please fill in all fields.");
      setTimeout(() => setError(null), 2000);
      return;
    }
    if (selectedDates.length !== 2) {
      setError("Please select a start and end date.");
      setTimeout(() => setError(null), 2000);
      return;
    }

    const [start_date, end_date] =
      selectedDates[0] < selectedDates[1] ? [selectedDates[0], selectedDates[1]] : [selectedDates[1], selectedDates[0]];

    const updatedBooking = {
      ...booking,
      name: form.name,
      email: form.email,
      phone: form.phone,
      start_date,
      end_date,
    };

    try {
      const res = await fetch(`/api/bookings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedBooking),
      });

      if (!res.ok) throw new Error("Failed to update booking");

      const saved = await res.json();
      onSave(saved);
      setSuccess("Changes successfully saved!");
      setTimeout(() => {
        setSuccess(null);
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      setError("Failed to update booking in database.");
      setTimeout(() => setError(null), 2000);
    }
  }

  function renderMonth(month: number) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const monthName = new Date(year, month, 1).toLocaleString("default", { month: "long" });

    return (
      <div key={month} className="mb-6">
        <div className="font-bold text-center mb-1">{monthName}</div>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} className="font-semibold">{d}</div>)}
          {Array(firstDay).fill(null).map((_, i) => <div key={"empty-" + i}></div>)}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`;
            const isBooked = bookedDates.has(dateStr);
            const isSelected = selectedDates.includes(dateStr);
            let isInRange = false;
            if (selectedDates.length === 2) {
              const [start, end] = selectedDates[0] < selectedDates[1] ? [selectedDates[0], selectedDates[1]] : [selectedDates[1], selectedDates[0]];
              isInRange = dateStr > start && dateStr < end;
            }
            return (
              <div
                key={i}
                className={`py-1 rounded cursor-pointer select-none transition
                  ${isBooked ? "line-through bg-red-200 text-gray-500 cursor-not-allowed" : ""}
                  ${isSelected ? "bg-blue-400 text-white font-bold" : ""}
                  ${isInRange ? "bg-blue-200 text-blue-900" : ""}
                  ${!isBooked && !isSelected && !isInRange ? "bg-green-100 hover:bg-blue-100" : ""}
                `}
                onClick={() => handleDateClick(dateStr)}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-xl min-w-[340px] max-h-[80vh] overflow-y-auto relative w-full max-w-2xl">
        <button className="absolute top-2 right-4 text-3xl" onClick={onClose}>&times;</button>
        <h3 className="text-xl font-bold mb-4 text-center">Edit Booking</h3>
        <div className="mb-4">
          <div className="font-semibold mb-1">Edit Dates:</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(12).fill(null).map((_, month) => renderMonth(month))}
          </div>
          <div className="mt-3 text-xs text-gray-500 text-center">
            <span className="inline-block w-3 h-3 bg-red-200 mr-1 align-middle" /> Booked &nbsp;
            <span className="inline-block w-3 h-3 bg-green-100 mr-1 align-middle" /> Available &nbsp;
            <span className="inline-block w-3 h-3 bg-blue-400 mr-1 align-middle" /> Selected
          </div>
        </div>
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2 text-center">Edit Details</h4>
          <div className="flex flex-col gap-2">
            <input className="border rounded px-2 py-1" name="name" placeholder="Name" value={form.name} onChange={handleInput} />
            <input className="border rounded px-2 py-1" name="email" placeholder="Email" type="email" value={form.email} onChange={handleInput} />
            <input className="border rounded px-2 py-1" name="phone" placeholder="Phone" value={form.phone} onChange={handleInput} />
            <button
              className="mt-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition text-lg font-bold mx-auto"
              onClick={handleSave}
            >
              Save Changes
            </button>

            {/* 🆕 Delete Button */}
            <button
              className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition text-lg font-bold mx-auto mt-2"
              onClick={() => setShowConfirmDelete(true)}
            >
              Delete Booking
            </button>

            {error && <div className="text-red-600 text-sm">{error}</div>}
            {success && <div className="text-green-600 text-sm">{success}</div>}
          </div>
          <div className="text-xs text-gray-400 mt-2 text-center">
            Booking: {selectedDates[0]} to {selectedDates[1]}
          </div>
        </div>

        {/* 🆕 Delete Confirmation Popup */}
        {showConfirmDelete && (
          <div className="relative -mt-38 z-10 flex flex-col gap-0 py-0">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg text-center">
              <p className="font-semibold mb-4">
                Are you sure you want to delete this booking?
              </p>
              <div className="flex justify-center gap-4">
                <button
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Yes, Delete"}
                </button>
                <button
                  className="bg-gray-300 text-black px-4 py-2 rounded hover:bg-gray-400 font-semibold"
                  onClick={() => setShowConfirmDelete(false)}
                >
                  No, Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- BookingsForDateModal ---
// ... Rest of your file remains unchanged


// --- BookingsForDateModal ---
function BookingsForDateModal({
  date,
  bookingsOnDate,
  vehicles,
  onClose,
  onEdit,
  categoryFilter,
  searchTerm,
}: {
  date: string;
  bookingsOnDate: any[];
  vehicles: any[];
  onClose: () => void;
  onEdit: (booking: any, vehicle: any) => void;
  categoryFilter: 'ALL' | 'XLT' | 'PRO';
  searchTerm: string;
}) {
  const lowerSearch = searchTerm.toLowerCase();
  const filteredBookings = bookingsOnDate.filter(b => {
    const vehicle = vehicles.find(v => v.vehicle_id === b.vehicle_id);
    if (!vehicle) return false;
    if (categoryFilter !== 'ALL' && !vehicle.trim.includes(categoryFilter)) return false;
    if (searchTerm && !b.name.toLowerCase().includes(lowerSearch)) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-xl shadow-xl min-w-[300px] max-w-lg w-full max-h-[70vh] overflow-y-auto relative">
        <button className="absolute top-2 right-4 text-2xl" onClick={onClose}>&times;</button>
        <h3 className="text-lg font-bold mb-4 text-center">Bookings for {date}</h3>
        {filteredBookings.length === 0 ? (
          <div className="text-center text-gray-500">No bookings on this day.</div>
        ) : (
          <ul className="flex flex-col gap-4">
            {filteredBookings.map((booking) => {
              const vehicle = vehicles.find(v => v.vehicle_id === booking.vehicle_id);
              return (
                <li key={booking.booking_id} className="border rounded-lg p-4 flex flex-col items-center gap-2 bg-gray-50 dark:bg-gray-800">
                  <div className="text-center">
                    <span className="font-semibold">Vehicle:</span> {vehicle?.model} {vehicle?.trim} <span className="text-xs text-gray-400">{vehicle?.vin}</span>
                  </div>
                  <div><span className="font-semibold">Booked by:</span> {booking.name}</div>
                  <div><span className="font-semibold">From:</span> {booking.start_date} <span className="font-semibold">To:</span> {booking.end_date}</div>
                  <button
                    className="mt-2 w-3/4 bg-blue-600 text-white px-6 py-3 rounded-lg text-lg font-bold hover:bg-blue-700 transition"
                    onClick={() => onEdit(booking, vehicle)}
                  >
                    Edit
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// --- YearlyCalendar ---
function YearlyCalendar({ bookings, onDateClick, vehicles, categoryFilter, searchTerm }: { bookings: any[], onDateClick: (date: string) => void, vehicles: any[], categoryFilter: 'ALL' | 'XLT' | 'PRO', searchTerm: string }) {
  const year = new Date().getFullYear();
  const bookedDates = getAllBookedDates(year, bookings, vehicles, categoryFilter, searchTerm);

  function renderMonth(month: number) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const monthName = new Date(year, month, 1).toLocaleString("default", { month: "long" });

    return (
      <div key={month} className="mb-6">
        <div className="font-bold text-center mb-1">{monthName}</div>
        <div className="grid grid-cols-7 gap-1 text-xs">
          {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => <div key={d} className="font-semibold">{d}</div>)}
          {Array(firstDay).fill(null).map((_, i) => <div key={"empty-" + i}></div>)}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const dateStr = `${year}-${String(month+1).padStart(2,"0")}-${String(i+1).padStart(2,"0")}`;
            const isBooked = bookedDates.has(dateStr);
            return (
              <div
                key={i}
                className={`py-1 rounded cursor-pointer select-none transition ${isBooked ? "bg-red-200 text-gray-900 font-bold hover:bg-red-300" : "bg-green-100 hover:bg-blue-100"}`}
                onClick={() => onDateClick(dateStr)}
              >
                {i+1}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-bold mb-4 text-center">Booking Calendar - {year}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array(12).fill(null).map((_, month) => renderMonth(month))}
      </div>
      <div className="mt-3 text-xs text-gray-500 text-center">
        <span className="inline-block w-3 h-3 bg-red-200 mr-1 align-middle" /> Booked &nbsp;
        <span className="inline-block w-3 h-3 bg-green-100 mr-1 align-middle" /> Available
      </div>
    </div>
  );
}

// --- Main Home Component ---
export default function Home() {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<'ALL'|'XLT'|'PRO'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedDate, setSelectedDate] = useState<string|null>(null);
  const [editBooking, setEditBooking] = useState<any|null>(null);
  const [editVehicle, setEditVehicle] = useState<any|null>(null);
  const [isListView, setIsListView] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [vRes,bRes] = await Promise.all([fetch("/api/vehicles"), fetch("/api/bookings")]);
        const [vehiclesData, bookingsData] = await Promise.all([vRes.json(), bRes.json()]);

        const normalizedBookings = bookingsData.map((b: any)=>({
          ...b,
          start_date: new Date(b.start_date).toISOString().slice(0,10),
          end_date: new Date(b.end_date).toISOString().slice(0,10),
        }));

        setVehicles(vehiclesData);
        setBookings(normalizedBookings);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="text-center mt-10">Loading...</div>;

  const bookingsOnSelectedDate = selectedDate ? getBookingsForDate(selectedDate, bookings, vehicles, categoryFilter, searchTerm) : [];

  function handleEdit(booking: any, vehicle: any) {
    setEditBooking(booking);
    setEditVehicle(vehicle);
    setIsListView(false); // return to calendar when editing
  }

  function handleSave(updatedBooking: any) {
    setBookings(prev => prev.map(b => b.booking_id === updatedBooking.booking_id ? updatedBooking : b));
  }

  return (
    <div className="font-sans flex flex-col items-center justify-start min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      <main className="w-full max-w-4xl mt-16 p-8 rounded-3xl shadow-xl bg-white/80 dark:bg-gray-900/80 flex flex-col items-center gap-8">
        <div className="flex flex-row items-center justify-center gap-8">
          <Image src="/bosscap.png" alt="Bosscap Logo" width={160} height={40} className="object-contain" priority />
          <Image src="/amq.png" alt="AMQ Logo" width={220} height={60} className="object-contain" priority />
        </div>
        <div className="absolute top-5 right-3">
          <Link
            href="/make_booking"
            className="px-6 py-3 rounded-lg bg-purple-600 text-white font-semibold text-lg shadow hover:bg-purple-700 transition-colors"
          >
           Make Booking
          </Link>
        </div>
        <div className="absolute top-5 left-3">
          <Link
            href="/"
            className="px-6 py-3 rounded-lg bg-black text-white font-semibold text-lg shadow hover:bg-gray-800 transition-colors"
          >
           🏠︎
          </Link>
        </div>
        <div className="flex flex-col items-center">
          <h1 className="text-4xl font-extrabold mb-1 tracking-tight text-gray-900 dark:text-white drop-shadow">
            Vehicle Loan System
          </h1>
          <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 tracking-wide">
            View/Edit Bookings
          </h2>
          <h3 className="text-l font-italic text-gray-700 dark:text-gray-300 tracking-wide">
            Click on a Booked Date to View and Edit the Bookings
          </h3>
        </div>

        {/* Search Bar */}
        <div className="w-full flex justify-center">
          <input
            type="text"
            placeholder="Search by name..."
            value={searchTerm}
            onChange={e=>setSearchTerm(e.target.value)}
            className="w-full md:w-1/2 px-3 py-2 border rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>

        {/* Category Tabs + List/Calendar Toggle */}
        <div className="flex gap-4 mt-2">
          {(['ALL','XLT','PRO'] as const).map(cat=>(
            <button
              key={cat}
              className={`px-4 py-2 rounded-lg font-semibold ${categoryFilter===cat?"bg-blue-600 text-white":"bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-400 hover:text-white"}`}
              onClick={()=>setCategoryFilter(cat)}
            >
              {cat}
            </button>
          ))}
          <button
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition font-semibold"
            onClick={()=>setIsListView(prev=>!prev)}
          >
            {isListView ? "Calendar View" : "List View"}
          </button>
        </div>

        <div className="w-full">
          {isListView ? (
            <div>  
              <h3 className="text-lg font-bold mb-4 text-center">All Bookings</h3>
              <ul className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-200 dark:divide-gray-700">
                {vehicles
                  .filter(vehicle => categoryFilter === 'ALL' || vehicle.trim.includes(categoryFilter))
                  .sort((a, b) => a.vehicle_id - b.vehicle_id)
                  .map(vehicle => {
                    const vehicleBookings = bookings.filter(
                      b =>
                        b.vehicle_id === vehicle.vehicle_id &&
                        (!searchTerm || b.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    );
                    return (
                      <li key={vehicle.vehicle_id} className="px-4 py-3">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">{vehicle.model} {vehicle.trim} (ID: {vehicle.vehicle_id})</span>
                          {vehicleBookings.length === 0 && <span className="text-gray-500 text-sm">No bookings</span>}
                        </div>
                        {vehicleBookings.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {vehicleBookings.map(booking => (
                              <li key={booking.booking_id} className="flex justify-between items-center border rounded px-2 py-1 bg-gray-100 dark:bg-gray-700">
                                <span className="text-sm">
                                  {booking.name} ({booking.start_date.split('-').reverse().join('/')} - {booking.end_date.split('-').reverse().join('/')})
                                </span>
                                <button
                                  className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-xs"
                                  onClick={() => { handleEdit(booking, vehicle); setIsListView(prev => !prev); }}
                                >
                                  Edit
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ) : (
            <YearlyCalendar
              bookings={bookings}
              onDateClick={setSelectedDate}
              vehicles={vehicles}
              categoryFilter={categoryFilter}
              searchTerm={searchTerm}
            />
          )}
        </div>

        {selectedDate && (
          <BookingsForDateModal
            date={selectedDate}
            bookingsOnDate={bookingsOnSelectedDate}
            vehicles={vehicles}
            onClose={()=>setSelectedDate(null)}
            onEdit={handleEdit}
            categoryFilter={categoryFilter}
            searchTerm={searchTerm}
          />
        )}

        {editBooking && editVehicle && (
          <EditBookingModal
            booking={editBooking}
            vehicle={editVehicle}
            bookings={bookings}
            onClose={()=>{ setEditBooking(null); setEditVehicle(null); }}
            onSave={handleSave}
          />
        )}
      </main>
    </div>
  );
}
