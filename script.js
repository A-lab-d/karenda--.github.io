import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Your web app's Firebase configuration
// この部分はindex.htmlに貼り付け済みなので、ここでは不要です。
// ただし、モジュールのインポートのために、Firebase Appの初期化は必要です。
// const app = initializeApp(firebaseConfig);
const db = getFirestore();

document.addEventListener('DOMContentLoaded', async () => {
    const calendarGrid = document.getElementById('calendarGrid');
    const currentMonthEl = document.getElementById('currentMonth');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    
    const bookingModal = document.getElementById('bookingModal');
    const closeBtn = document.querySelector('.close-btn');
    const selectedDateText = document.getElementById('selectedDateText');
    const bookingForm = document.getElementById('bookingForm');
    const deleteBtn = document.getElementById('deleteBtn');
    const bookingMemo = document.getElementById('bookingMemo');
    const bookingTime = document.getElementById('bookingTime');
    const endTime = document.getElementById('endTime');

    let currentDate = new Date();
    // 💡 ローカルストレージの代わりにFirebaseからデータを取得
    let savedBookings = {}; 
    let editingBookingIndex = null;

    // 💡 Firebaseからデータを読み込む関数
    async function fetchBookingsFromFirebase() {
        const bookingsCollection = collection(db, "bookings");
        const bookingsSnapshot = await getDocs(bookingsCollection);
        const fetchedBookings = {};
        bookingsSnapshot.forEach((doc) => {
            const data = doc.data();
            fetchedBookings[doc.id] = data.bookings;
        });
        savedBookings = fetchedBookings;
    }

    async function renderCalendar() {
        // 💡 Firebaseから最新のデータを取得
        await fetchBookingsFromFirebase();
        
        calendarGrid.innerHTML = `
            <div class="day-name">日</div>
            <div class="day-name">月</div>
            <div class="day-name">火</div>
            <div class="day-name">水</div>
            <div class="day-name">木</div>
            <div class="day-name">金</div>
            <div class="day-name">土</div>
        `;

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        currentMonthEl.textContent = `${year}年 ${month + 1}月`;

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.classList.add('day', 'empty');
            calendarGrid.appendChild(emptyDay);
        }

        for (let day = 1; day <= lastDayOfMonth; day++) {
            const dayEl = document.createElement('div');
            dayEl.classList.add('day');
            dayEl.textContent = day;
            const formattedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dayEl.dataset.date = formattedDate;

            const dayOfWeek = new Date(year, month, day).getDay();
            if (dayOfWeek === 0) {
                dayEl.classList.add('sunday');
            } else if (dayOfWeek === 6) {
                dayEl.classList.add('saturday');
            }
            const holidays = ["2025-01-01", "2025-01-13", "2025-02-11", "2025-02-24", "2025-03-20", "2025-04-29", "2025-05-03", "2025-05-05", "2025-05-06", "2025-07-21", "2025-08-11", "2025-09-15", "2025-09-23", "2025-10-13", "2025-11-03", "2025-11-24", "2025-12-23"];
            if (holidays.includes(formattedDate)) {
                dayEl.classList.add('holiday');
            }

            if (savedBookings[formattedDate] && savedBookings[formattedDate].length > 0) {
                dayEl.classList.add('has-booking');
                const bookings = savedBookings[formattedDate];
                const summaryDiv = document.createElement('div');
                summaryDiv.classList.add('booking-summary');
                bookings.forEach(booking => {
                    const bookingEl = document.createElement('p');
                    bookingEl.textContent = `${booking.startTime} - ${booking.endTime} ${booking.memo}`;
                    bookingEl.classList.add('individual-booking');
                    summaryDiv.appendChild(bookingEl);
                });
                dayEl.appendChild(summaryDiv);
            }

            calendarGrid.appendChild(dayEl);
        }
    }

    calendarGrid.addEventListener('click', (e) => {
        const target = e.target.closest('.day');
        if (target && !target.classList.contains('empty')) {
            const selectedDate = target.dataset.date;
            selectedDateText.textContent = `${selectedDate} の予約/メモ`;

            const selectedDay = document.querySelector('.day.selected');
            if (selectedDay) {
                selectedDay.classList.remove('selected');
            }
            target.classList.add('selected');

            bookingForm.reset();
            deleteBtn.style.display = 'none';
            editingBookingIndex = null;
            
            if (savedBookings[selectedDate]) {
                const existingBookings = savedBookings[selectedDate].map(
                    (booking, index) => `<p data-index="${index}" class="booking-item">${booking.startTime} - ${booking.endTime} ${booking.memo}</p>`
                ).join('');
                document.getElementById('existingBookings').innerHTML = existingBookings;
            } else {
                document.getElementById('existingBookings').innerHTML = '';
            }

            bookingModal.style.display = 'flex';
        }
    });
    
    document.getElementById('existingBookings').addEventListener('click', (e) => {
        const targetItem = e.target.closest('.booking-item');
        if (targetItem) {
            const index = parseInt(targetItem.dataset.index);
            const selectedDate = document.querySelector('.day.selected').dataset.date;
            const booking = savedBookings[selectedDate][index];
            
            bookingTime.value = booking.startTime;
            endTime.value = booking.endTime;
            bookingMemo.value = booking.memo;
            deleteBtn.style.display = 'block';
            editingBookingIndex = index;
        }
    });

    closeBtn.addEventListener('click', () => {
        bookingModal.style.display = 'none';
        const selectedDay = document.querySelector('.day.selected');
        if (selectedDay) {
            selectedDay.classList.remove('selected');
        }
    });

    bookingForm.addEventListener('submit', async (e) => { // 💡 asyncを追加
        e.preventDefault();
        const selectedDate = document.querySelector('.day.selected').dataset.date;
        const startTime = bookingTime.value;
        const endT = endTime.value;
        const memo = bookingMemo.value;

  // 💡 10分刻みチェックを追加
        if (startTime.slice(3, 5) % 10 !== 0 || endT.slice(3, 5) % 10 !== 0) {
            alert('時間を10分刻みで入力してください。');
            return;
        }

        if (startTime >= endT) {
            alert('終了時間は開始時間より後に設定してください。');
            return;
        }

        const isTimeConflict = savedBookings[selectedDate] && savedBookings[selectedDate].some((booking, index) => {
            if (index === editingBookingIndex) return false;
            
            const existingStart = new Date(`${selectedDate}T${booking.startTime}:00`);
            const existingEnd = new Date(`${selectedDate}T${booking.endTime}:00`);
            const newStart = new Date(`${selectedDate}T${startTime}:00`);
            const newEnd = new Date(`${selectedDate}T${endT}:00`);
            
            return (
                (newStart < existingEnd && newEnd > existingStart)
            );
        });

        if (isTimeConflict) {
            alert('この時間帯は既に予約が入っています。');
            return;
        }
        
        const newBooking = { startTime: startTime, endTime: endT, memo: memo };

        if (editingBookingIndex !== null) {
            savedBookings[selectedDate][editingBookingIndex] = newBooking;
            editingBookingIndex = null;
        } else {
            if (!savedBookings[selectedDate]) {
                savedBookings[selectedDate] = [];
            }
            savedBookings[selectedDate].push(newBooking);
        }

        // 💡 Firebaseにデータを保存
        const dateDocRef = doc(db, "bookings", selectedDate);
        await setDoc(dateDocRef, { bookings: savedBookings[selectedDate] });

        alert(`${selectedDate} にメモを保存しました。`);

        bookingModal.style.display = 'none';
        renderCalendar();
    });

    deleteBtn.addEventListener('click', async () => { // 💡 asyncを追加
        const selectedDate = document.querySelector('.day.selected').dataset.date;
        
        if (editingBookingIndex !== null) {
            savedBookings[selectedDate].splice(editingBookingIndex, 1);
        }
        
        const dateDocRef = doc(db, "bookings", selectedDate);
        if (savedBookings[selectedDate].length === 0) {
            delete savedBookings[selectedDate];
            // 💡 データベースからドキュメントを削除
            await deleteDoc(dateDocRef);
        } else {
            // 💡 データベースのデータを更新
            await setDoc(dateDocRef, { bookings: savedBookings[selectedDate] });
        }

        alert('予約/メモを削除しました。');
        editingBookingIndex = null;

        bookingModal.style.display = 'none';
        renderCalendar();
    });

    closeBtn.addEventListener('click', () => {
        bookingModal.style.display = 'none';
        const selectedDay = document.querySelector('.day.selected');
        if (selectedDay) {
            selectedDay.classList.remove('selected');
        }
    });

    prevBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });

    nextBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });

    // 初期描画
    renderCalendar();
});