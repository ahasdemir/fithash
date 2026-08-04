import { Exercise, Routine } from '../types/fitness';

export const INITIAL_EXERCISES: Exercise[] = [
  // --- TEMEL VE İZOLE HAREKETLER ---
  { id: 'ex_barbell_bench', name: 'Barbell Bench Press', category: 'Göğüs', equipment: 'Barbell', targetMuscle: 'Orta Göğüs', instructions: 'Barda omuz genişliğinde tutuş yapın, kontrollü indirin ve patlayıcı itin.' },
  { id: 'ex_bench_mch', name: 'Bench Press MCH', category: 'Göğüs', equipment: 'Makine', targetMuscle: 'Orta Göğüs', instructions: 'Bench press makinesinde göğsü sıkarak itin, RIR 0-1 seviyesinde tükenişe yakın çalışın.' },
  { id: 'ex_incline_press_mch', name: 'Incline Press MCH', category: 'Göğüs', equipment: 'Makine', targetMuscle: 'Üst Göğüs', instructions: 'Eğimli göğüs pres makinesi, üst göğsü hedefleyin.' },
  { id: 'ex_incline_fly_mch', name: 'Incline Fly MCH', category: 'Göğüs', equipment: 'Makine', targetMuscle: 'Üst Göğüs İzolasyon', instructions: 'Eğimli fly makinesinde göğsü esneterek kapatın.' },
  { id: 'ex_fly_machine', name: 'Fly Machine (Pec Deck)', category: 'Göğüs', equipment: 'Makine', targetMuscle: 'İç Göğüs', instructions: 'Kolları göğüs önünde birleştirip tepe noktada sıkın.' },
  { id: 'ex_lat_pulldown', name: 'Lat Pulldown', category: 'Sırt', equipment: 'Kablo', targetMuscle: 'Kanat (Latissimus)', instructions: 'Geniş tutuşla barı üst göğse çekin, RIR 1 seviyesini koruyun.' },
  { id: 'ex_tbar_row_cs', name: 'T-Bar Row (Chest Supported)', category: 'Sırt', equipment: 'Makine', targetMuscle: 'Orta Sırt & Kalınlık', instructions: 'Göğüs destekli T-Bar çekiş, beli koruyarak sırtı sıkıştırın.' },
  { id: 'ex_tbar_row', name: 'T-Bar Row', category: 'Sırt', equipment: 'Barbell', targetMuscle: 'Orta Sırt', instructions: 'T-Bar aparatı ile gövde eğik çekiş.' },
  { id: 'ex_db_row', name: 'Dumbbell Row', category: 'Sırt', equipment: 'Dumbbell', targetMuscle: 'Kanat & Sırt', instructions: 'Sehpaya dayalı tek kol dambıl çekiş.' },
  { id: 'ex_ohp_mch', name: 'Overhead Press MCH', category: 'Omuz', equipment: 'Makine', targetMuscle: 'Ön & Yan Omuz', instructions: 'Omuz pres makinesinde baş üstüne itin.' },
  { id: 'ex_lat_raise_drop', name: 'Lateral Raise (Dropset)', category: 'Omuz', equipment: 'Dumbbell', targetMuscle: 'Yan Omuz', instructions: 'Ağır kilodan hafif kiloya noksansız dropset, RIR 0 (tam tükeniş).' },
  { id: 'ex_reverse_fly', name: 'Reverse Fly', category: 'Omuz', equipment: 'Makine', targetMuscle: 'Arka Omuz', instructions: 'Ters fly makinesi ile arka omuzları sıkıştırın.' },
  { id: 'ex_leg_press', name: 'Leg Press', category: 'Bacak', equipment: 'Makine', targetMuscle: 'Ön Bacak & Kalça', instructions: 'Leg press platformunda dizleri 90 derece büküp itin.' },
  { id: 'ex_leg_extension', name: 'Leg Extension', category: 'Bacak', equipment: 'Makine', targetMuscle: 'Ön Bacak İzolasyon', instructions: 'Bacak uzatma makinesi, tepe noktada kası kilitleyin.' },
  { id: 'ex_leg_curl', name: 'Leg Curl', category: 'Bacak', equipment: 'Makine', targetMuscle: 'Arka Bacak (Hamstrings)', instructions: 'Arka bacak bükme makinesi.' },
  { id: 'ex_calf_hacksquat', name: 'Calf Raise (Hacksquat)', category: 'Bacak', equipment: 'Makine', targetMuscle: 'Kalf', instructions: 'Hacksquat makinesinde parmak ucunda yükselin.' },
  { id: 'ex_hammer_curl', name: 'Hammer Curl', category: 'Ön Kol', equipment: 'Dumbbell', targetMuscle: 'Brachialis & Ön Kol', instructions: 'Avuç içleri birbirine bakacak şekilde dambıl bükme.' },
  { id: 'ex_machine_curl', name: 'Machine Curl', category: 'Ön Kol', equipment: 'Makine', targetMuscle: 'Biceps İzolasyon', instructions: 'Biceps curl makinesi.' },
  { id: 'ex_biceps_curl', name: 'Biceps Curl', category: 'Ön Kol', equipment: 'Dumbbell', targetMuscle: 'Biceps Brachii', instructions: 'Klasik dambıl biceps bükme.' },
  { id: 'ex_barbell_curl', name: 'Barbell Curl', category: 'Ön Kol', equipment: 'Barbell', targetMuscle: 'Biceps Hacim', instructions: 'Barbell ile ayakta biceps bükme.' },
  { id: 'ex_rope_pushdown', name: 'Rope Pushdown', category: 'Arka Kol', equipment: 'Kablo', targetMuscle: 'Triceps', instructions: 'Üst makara halat aşağı itin.' },
  { id: 'ex_bar_pushdown', name: 'Bar Pushdown', category: 'Arka Kol', equipment: 'Kablo', targetMuscle: 'Triceps Güç', instructions: 'Düz bar ile kablo triceps itin.' },

  // --- KARDİYO HAREKETLERİ ---
  { id: 'ex_cardio_walking', name: 'Yürüyüş (Tempolu)', category: 'Kardiyo', equipment: 'Kardiyo Cihazı', targetMuscle: 'Kardiyovasküler', instructions: 'Eğimli veya düz zemin tempolu yürüyüş.' },
  { id: 'ex_cardio_cycling', name: 'Bisiklet (Kardiyo)', category: 'Kardiyo', equipment: 'Kardiyo Cihazı', targetMuscle: 'Kardiyovasküler & Bacak', instructions: 'Sabit kondisyon bisikletinde sürekli tempo.' },
  { id: 'ex_cardio_elliptical', name: 'Eliptik Bisiklet', category: 'Kardiyo', equipment: 'Kardiyo Cihazı', targetMuscle: 'Tüm Vücut Kardiyo', instructions: 'Eliptik makinede akıcı tüm vücut hareketi.' },
  { id: 'ex_cardio_treadmill', name: 'Koşu Bandı', category: 'Kardiyo', equipment: 'Kardiyo Cihazı', targetMuscle: 'Kardiyovasküler', instructions: 'Koşu temposunda kalori yakımı.' },
  { id: 'ex_cardio_rowing', name: 'Kürek Ergometresi', category: 'Kardiyo', equipment: 'Kardiyo Cihazı', targetMuscle: 'Sırt & Bacak Kardiyo', instructions: 'Kürek makinesinde patlayıcı bacak itişi ve sırt çekişi.' },

  // --- GENEL KÜTÜPHANE HAREKETLERİ ---
  { id: 'ex_chest_2', name: 'Incline Dumbbell Press', category: 'Göğüs', equipment: 'Dumbbell', targetMuscle: 'Üst Göğüs', instructions: '30-45 derece eğimli sehpada dambılları yukarı kaldırın.' },
  { id: 'ex_back_1', name: 'Barbell Deadlift', category: 'Sırt', equipment: 'Barbell', targetMuscle: 'Arka Zincir / Bel', instructions: 'Sırtı düz tutarak halterle ayağa kalkın.' },
  { id: 'ex_legs_1', name: 'Barbell Back Squat', category: 'Bacak', equipment: 'Barbell', targetMuscle: 'Ön Bacak & Kalça', instructions: 'Barı trapezlere alıp çömelin.' },
  { id: 'ex_shoulders_1', name: 'Overhead Barbell Press (OHP)', category: 'Omuz', equipment: 'Barbell', targetMuscle: 'Ön & Yan Omuz', instructions: 'Ayakta barı baş üstüne itin.' },
  { id: 'ex_abs_1', name: 'Cable Woodchopper', category: 'Karın', equipment: 'Kablo', targetMuscle: 'Oblikler', instructions: 'Kabloyu çapraz çekin.' },
  { id: 'ex_abs_2', name: 'Hanging Leg Raise', category: 'Karın', equipment: 'Vücut Ağırlığı', targetMuscle: 'Alt Karın', instructions: 'Barfiks barında bacak kaldırın.' },
];

export const DEFAULT_ROUTINES: Routine[] = [
  {
    id: 'routine_program_a',
    name: 'Program A (Göğüs & Sırt Güç)',
    description: 'Barbell Bench Press, Bench Press Makinesi ve Lat Pulldown ile odaklı güç seansı.',
    category: 'Güç & Hacim',
    createdAt: '2026-08-04T00:00:00.000Z',
    exercises: [
      { exerciseId: 'ex_barbell_bench', exerciseName: 'Barbell Bench Press', category: 'Göğüs', equipment: 'Barbell', targetSets: 2, targetReps: 10, targetWeight: 32.5, targetRir: 1 },
      { exerciseId: 'ex_bench_mch', exerciseName: 'Bench Press MCH', category: 'Göğüs', equipment: 'Makine', targetSets: 3, targetReps: 8, targetWeight: 90, targetRir: 1 },
      { exerciseId: 'ex_lat_pulldown', exerciseName: 'Lat Pulldown', category: 'Sırt', equipment: 'Kablo', targetSets: 3, targetReps: 10, targetWeight: 65, targetRir: 1 },
    ]
  },
  {
    id: 'routine_program_b',
    name: 'Program B (Omuz, Bacak, Kol & Sırt)',
    description: 'Overhead Press MCH, Hammer Curl, Leg Press, T-Bar Row ve Dropset Lateral Raise.',
    category: 'Hipertrofi',
    createdAt: '2026-08-04T00:00:00.000Z',
    exercises: [
      { exerciseId: 'ex_ohp_mch', exerciseName: 'Overhead Press MCH', category: 'Omuz', equipment: 'Makine', targetSets: 3, targetReps: 12, targetWeight: 62.5, targetRir: 1 },
      { exerciseId: 'ex_hammer_curl', exerciseName: 'Hammer Curl', category: 'Ön Kol', equipment: 'Dumbbell', targetSets: 3, targetReps: 12, targetWeight: 12.5, targetRir: 1 },
      { exerciseId: 'ex_leg_press', exerciseName: 'Leg Press', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 12, targetWeight: 210, targetRir: 1 },
      { exerciseId: 'ex_tbar_row_cs', exerciseName: 'T-Bar Row (Chest Supported)', category: 'Sırt', equipment: 'Makine', targetSets: 3, targetReps: 10, targetWeight: 40, targetRir: 1 },
      { exerciseId: 'ex_lat_raise_drop', exerciseName: 'Lateral Raise (Dropset)', category: 'Omuz', equipment: 'Dumbbell', targetSets: 4, targetReps: 12, targetWeight: 10, targetRir: 0 },
    ]
  },
  {
    id: 'routine_program_c',
    name: 'Program C (Tüm Vücut Yükleme)',
    description: 'Bench MCH, Lat Pulldown, OHP, Fly, Leg Press, Hammer Curl ve Rope Pushdown.',
    category: 'Tüm Vücut',
    createdAt: '2026-08-04T00:00:00.000Z',
    exercises: [
      { exerciseId: 'ex_bench_mch', exerciseName: 'Bench Press MCH', category: 'Göğüs', equipment: 'Makine', targetSets: 3, targetReps: 7, targetWeight: 90, targetRir: 1 },
      { exerciseId: 'ex_lat_pulldown', exerciseName: 'Lat Pulldown', category: 'Sırt', equipment: 'Kablo', targetSets: 3, targetReps: 9, targetWeight: 65, targetRir: 1 },
      { exerciseId: 'ex_ohp_mch', exerciseName: 'Overhead Press MCH', category: 'Omuz', equipment: 'Makine', targetSets: 3, targetReps: 12, targetWeight: 60, targetRir: 1 },
      { exerciseId: 'ex_fly_machine', exerciseName: 'Fly Machine (Pec Deck)', category: 'Göğüs', equipment: 'Makine', targetSets: 3, targetReps: 14, targetWeight: 20, targetRir: 1 },
      { exerciseId: 'ex_leg_press', exerciseName: 'Leg Press', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 11, targetWeight: 210, targetRir: 1 },
      { exerciseId: 'ex_hammer_curl', exerciseName: 'Hammer Curl', category: 'Ön Kol', equipment: 'Dumbbell', targetSets: 3, targetReps: 12, targetWeight: 12.5, targetRir: 1 },
      { exerciseId: 'ex_rope_pushdown', exerciseName: 'Rope Pushdown', category: 'Arka Kol', equipment: 'Kablo', targetSets: 3, targetReps: 12, targetWeight: 25, targetRir: 1 },
    ]
  },
  {
    id: 'routine_program_d',
    name: 'Program D (Üst Vücut & Bacak İzolasyon)',
    description: 'Lateral Raise, Incline Press MCH, T-Bar Row, Leg Extension, Machine Curl ve Bar Pushdown.',
    category: 'Split İzolasyon',
    createdAt: '2026-08-04T00:00:00.000Z',
    exercises: [
      { exerciseId: 'ex_lat_raise_drop', exerciseName: 'Lateral Raise (Dropset)', category: 'Omuz', equipment: 'Dumbbell', targetSets: 4, targetReps: 10, targetWeight: 10, targetRir: 0 },
      { exerciseId: 'ex_incline_press_mch', exerciseName: 'Incline Press MCH', category: 'Göğüs', equipment: 'Makine', targetSets: 3, targetReps: 9, targetWeight: 55, targetRir: 0 },
      { exerciseId: 'ex_tbar_row', exerciseName: 'T-Bar Row', category: 'Sırt', equipment: 'Barbell', targetSets: 3, targetReps: 8, targetWeight: 40, targetRir: 1 },
      { exerciseId: 'ex_leg_extension', exerciseName: 'Leg Extension', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 12, targetWeight: 15, targetRir: 0 },
      { exerciseId: 'ex_machine_curl', exerciseName: 'Machine Curl', category: 'Ön Kol', equipment: 'Makine', targetSets: 3, targetReps: 11, targetWeight: 45, targetRir: 1 },
      { exerciseId: 'ex_bar_pushdown', exerciseName: 'Bar Pushdown', category: 'Arka Kol', equipment: 'Kablo', targetSets: 3, targetReps: 12, targetWeight: 25, targetRir: 1 },
    ]
  },
  {
    id: 'routine_program_e',
    name: 'Program E (Kapsamlı İtiş, Çekiş & Bacak)',
    description: 'Incline Fly MCH, DB Row, Reverse Fly, Leg Curl, Hacksquat Calf, Biceps & Triceps.',
    category: 'Hipertrofi Split',
    createdAt: '2026-08-04T00:00:00.000Z',
    exercises: [
      { exerciseId: 'ex_incline_fly_mch', exerciseName: 'Incline Fly MCH', category: 'Göğüs', equipment: 'Makine', targetSets: 3, targetReps: 13, targetWeight: 20, targetRir: 1 },
      { exerciseId: 'ex_db_row', exerciseName: 'Dumbbell Row', category: 'Sırt', equipment: 'Dumbbell', targetSets: 3, targetReps: 11, targetWeight: 25, targetRir: 1 },
      { exerciseId: 'ex_reverse_fly', exerciseName: 'Reverse Fly', category: 'Omuz', equipment: 'Makine', targetSets: 3, targetReps: 10, targetWeight: 32, targetRir: 0 },
      { exerciseId: 'ex_leg_curl', exerciseName: 'Leg Curl', category: 'Bacak', equipment: 'Makine', targetSets: 3, targetReps: 11, targetWeight: 30, targetRir: 1 },
      { exerciseId: 'ex_calf_hacksquat', exerciseName: 'Calf Raise (Hacksquat)', category: 'Bacak', equipment: 'Makine', targetSets: 4, targetReps: 21, targetWeight: 70, targetRir: 1 },
      { exerciseId: 'ex_biceps_curl', exerciseName: 'Biceps Curl', category: 'Ön Kol', equipment: 'Dumbbell', targetSets: 2, targetReps: 9, targetWeight: 12.5, targetRir: 1 },
      { exerciseId: 'ex_rope_pushdown', exerciseName: 'Rope Pushdown', category: 'Arka Kol', equipment: 'Kablo', targetSets: 3, targetReps: 10, targetWeight: 25, targetRir: 1 },
      { exerciseId: 'ex_barbell_curl', exerciseName: 'Barbell Curl', category: 'Ön Kol', equipment: 'Barbell', targetSets: 2, targetReps: 12, targetWeight: 17.5, targetRir: 1 },
    ]
  },
  {
    id: 'routine_program_f',
    name: 'Program F (Kardiyo & Yağ Yakımı)',
    description: 'Eliptik, Yürüyüş ve Bisiklet ile yüksek kalori yakımı ve kondisyon seansı.',
    category: 'Kardiyo',
    createdAt: '2026-08-04T00:00:00.000Z',
    exercises: [
      { exerciseId: 'ex_cardio_elliptical', exerciseName: 'Eliptik Bisiklet', category: 'Kardiyo', equipment: 'Kardiyo Cihazı', targetSets: 1, targetReps: 1, targetDurationMinutes: 20, targetDistanceKm: 4.0 },
      { exerciseId: 'ex_cardio_cycling', exerciseName: 'Bisiklet (Kardiyo)', category: 'Kardiyo', equipment: 'Kardiyo Cihazı', targetSets: 1, targetReps: 1, targetDurationMinutes: 15, targetDistanceKm: 6.0 },
      { exerciseId: 'ex_cardio_walking', exerciseName: 'Yürüyüş (Tempolu)', category: 'Kardiyo', equipment: 'Kardiyo Cihazı', targetSets: 1, targetReps: 1, targetDurationMinutes: 15, targetDistanceKm: 1.5 },
    ]
  }
];
