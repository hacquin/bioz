// --- DEMO DATA ---
// Données statiques pour le mode démo (snapshot du compte réel)
// Ces données ne sont jamais modifiées ni synchronisées avec Firebase

const generateDemoHealthLogs = () => {
  const logs = [];
  const baseDate = new Date('2025-10-01');
  const today = new Date();

  // Progression réaliste sur ~5 mois : 106kg → ~98kg, 26% → ~20%, 107cm → ~99cm
  let weight = 106;
  let bodyFat = 26;
  let waist = 107;
  let muscleMass = 42.5;
  let hydration = 48;

  const dayCount = Math.floor((today - baseDate) / (1000 * 60 * 60 * 24));

  for (let i = 0; i <= dayCount; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    // Skip ~30% des jours (pas de mesure chaque jour)
    if (Math.random() < 0.3 && i > 0 && i < dayCount - 5) continue;

    // Progression avec bruit réaliste
    const progress = i / dayCount;
    weight = 106 - (8 * progress) + (Math.random() - 0.5) * 1.2;
    bodyFat = 26 - (6 * progress) + (Math.random() - 0.5) * 0.8;
    waist = 107 - (8 * progress) + (Math.random() - 0.5) * 1.0;
    muscleMass = 42.5 + (1.5 * progress) + (Math.random() - 0.5) * 0.5;
    hydration = 48 + (4 * progress) + (Math.random() - 0.5) * 1.5;

    const steps = Math.floor(4000 + Math.random() * 10000);
    const distance = parseFloat((steps * 0.00075).toFixed(2));

    logs.push({
      id: `demo_${i}`,
      date: date.toISOString(),
      weight: parseFloat(weight.toFixed(2)),
      bodyFat: parseFloat(bodyFat.toFixed(1)),
      muscleMass: parseFloat(muscleMass.toFixed(1)),
      hydration: parseFloat(hydration.toFixed(1)),
      waist: parseFloat(waist.toFixed(1)),
      steps,
      distance,
      systolic: Math.floor(125 + Math.random() * 15),
      diastolic: Math.floor(78 + Math.random() * 10),
      restingHR: Math.floor(58 + Math.random() * 8),
      pwv: parseFloat((7.5 + Math.random() * 1.5).toFixed(1)),
      visceralFat: parseFloat((12 - 3 * progress + Math.random() * 1).toFixed(1)),
      bmr: Math.floor(1850 + Math.random() * 100),
      vascularAge: parseFloat((52 + Math.random() * 4).toFixed(1)),
    });
  }

  return logs.sort((a, b) => new Date(a.date) - new Date(b.date));
};

const generateDemoStravaLogs = () => {
  const activities = [];
  const types = [
    { type: 'Run', names: ['Footing matinal', 'Course en ville', 'Fractionné 30/30', 'Sortie longue dimanche', 'Easy run récup'] },
    { type: 'Ride', names: ['Sortie vélo collines', 'Vélo taff', 'Grimpée du col', 'Boucle rapide'] },
    { type: 'VirtualRide', names: ['Zwift - Watopia flat', 'Zwift - Group ride', 'Zwift FTP test'] },
    { type: 'Swim', names: ['Natation 50m', 'Piscine technique', 'Nage libre 1500m'] },
    { type: 'Walk', names: ['Marche digestive', 'Balade forêt', 'Marche rapide'] },
    { type: 'WeightTraining', names: ['Séance muscu boxe', 'Circuit training'] },
    { type: 'Rowing', names: ['Rameur 5000m', 'Rameur intervalles'] },
  ];

  const baseDate = new Date();
  baseDate.setMonth(baseDate.getMonth() - 4);

  let id = 1000;
  for (let i = 0; i < 120; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);

    // 0-2 activités par jour
    const numActivities = Math.random() < 0.4 ? 0 : Math.random() < 0.7 ? 1 : 2;

    for (let j = 0; j < numActivities; j++) {
      const typeGroup = types[Math.floor(Math.random() * types.length)];
      const name = typeGroup.names[Math.floor(Math.random() * typeGroup.names.length)];
      const hour = 6 + Math.floor(Math.random() * 14);
      date.setHours(hour, Math.floor(Math.random() * 60));

      let moving_time, distance, average_speed, average_heartrate;

      switch (typeGroup.type) {
        case 'Run':
          moving_time = 1200 + Math.floor(Math.random() * 3600);
          average_speed = 2.2 + Math.random() * 1.5;
          distance = average_speed * moving_time;
          average_heartrate = 135 + Math.floor(Math.random() * 25);
          break;
        case 'Ride':
        case 'VirtualRide':
          moving_time = 2400 + Math.floor(Math.random() * 5400);
          average_speed = 5.5 + Math.random() * 3;
          distance = average_speed * moving_time;
          average_heartrate = 125 + Math.floor(Math.random() * 20);
          break;
        case 'Swim':
          moving_time = 1200 + Math.floor(Math.random() * 2400);
          distance = 800 + Math.floor(Math.random() * 2000);
          average_speed = distance / moving_time;
          average_heartrate = 120 + Math.floor(Math.random() * 25);
          break;
        case 'Walk':
          moving_time = 1800 + Math.floor(Math.random() * 3600);
          average_speed = 1.2 + Math.random() * 0.5;
          distance = average_speed * moving_time;
          average_heartrate = 95 + Math.floor(Math.random() * 15);
          break;
        case 'Rowing':
          moving_time = 900 + Math.floor(Math.random() * 1800);
          distance = 2000 + Math.floor(Math.random() * 5000);
          average_speed = distance / moving_time;
          average_heartrate = 140 + Math.floor(Math.random() * 20);
          break;
        default:
          moving_time = 1800 + Math.floor(Math.random() * 3600);
          distance = 0;
          average_speed = 0;
          average_heartrate = 130 + Math.floor(Math.random() * 20);
      }

      activities.push({
        id: id++,
        name,
        type: typeGroup.type,
        start_date: date.toISOString(),
        moving_time,
        distance: Math.round(distance),
        average_speed: parseFloat(average_speed.toFixed(2)),
        average_heartrate: Math.round(average_heartrate),
      });
    }
  }

  return activities.sort((a, b) => new Date(b.start_date) - new Date(a.start_date)).slice(0, 150);
};

const generateDemoHevyWorkouts = () => {
  const exercises = {
    push: [
      { title: 'Bench Press (Barbell)', weights: [60, 70, 80, 85] },
      { title: 'Incline Bench Press (Dumbbell)', weights: [24, 28, 32] },
      { title: 'Overhead Press (Barbell)', weights: [35, 40, 45] },
      { title: 'Dips', weights: [0, 10, 15] },
      { title: 'Cable Fly', weights: [15, 20, 22.5] },
    ],
    pull: [
      { title: 'Deadlift (Barbell)', weights: [100, 110, 120, 130] },
      { title: 'Barbell Row', weights: [60, 70, 75] },
      { title: 'Lat Pulldown (Cable)', weights: [55, 60, 65] },
      { title: 'Face Pull (Cable)', weights: [20, 25, 27.5] },
      { title: 'Bicep Curl (Dumbbell)', weights: [12, 14, 16] },
    ],
    legs: [
      { title: 'Squat (Barbell)', weights: [80, 90, 100, 105] },
      { title: 'Leg Press', weights: [150, 180, 200] },
      { title: 'Romanian Deadlift (Barbell)', weights: [70, 80, 90] },
      { title: 'Leg Extension (Machine)', weights: [45, 50, 55] },
      { title: 'Calf Raise (Machine)', weights: [60, 70, 80] },
    ],
  };

  const workoutTypes = [
    { title: 'Push Day', muscles: 'push' },
    { title: 'Pull Day', muscles: 'pull' },
    { title: 'Leg Day', muscles: 'legs' },
    { title: 'Upper Body', muscles: 'push' },
    { title: 'Full Body', muscles: 'legs' },
  ];

  const workouts = [];
  const baseDate = new Date();
  baseDate.setMonth(baseDate.getMonth() - 3);

  let id = 5000;
  let currentDate = new Date(baseDate);

  while (currentDate < new Date()) {
    // 3-5 séances par semaine
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 4 || (Math.random() < 0.3 && dayOfWeek !== 6)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    const wType = workoutTypes[Math.floor(Math.random() * workoutTypes.length)];
    const startTime = new Date(currentDate);
    startTime.setHours(7 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60));
    const duration = 45 + Math.floor(Math.random() * 45); // 45-90 min
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const muscleGroup = exercises[wType.muscles];
    const numExercises = 3 + Math.floor(Math.random() * 3);
    const selectedExercises = [...muscleGroup].sort(() => Math.random() - 0.5).slice(0, numExercises);

    const workoutExercises = selectedExercises.map(exo => {
      const numSets = 3 + Math.floor(Math.random() * 2);
      const sets = [];
      for (let s = 0; s < numSets; s++) {
        const weightIdx = Math.min(s, exo.weights.length - 1);
        const w = exo.weights[weightIdx] + (Math.random() - 0.5) * 5;
        sets.push({
          weight_kg: parseFloat(Math.max(0, w).toFixed(1)),
          reps: 6 + Math.floor(Math.random() * 7),
        });
      }
      return { title: exo.title, sets };
    });

    workouts.push({
      id: `demo_hevy_${id++}`,
      title: wType.title,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      exercises: workoutExercises,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return workouts.sort((a, b) => new Date(b.start_time) - new Date(a.start_time)).slice(0, 50);
};

const generateDemoNutritionDocs = () => {
  const docs = [];
  const today = new Date();
  // Générer 30 jours de données nutrition (régime cétogène)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    // Skip ~20% des jours
    if (Math.random() < 0.2 && i > 0 && i < 28) continue;
    const date = d.toISOString().split('T')[0];
    const carbs = 8 + Math.round(Math.random() * 18); // 8-26g (keto)
    const fat = 90 + Math.round(Math.random() * 70); // 90-160g
    const protein = 70 + Math.round(Math.random() * 60); // 70-130g
    const fiber = 3 + Math.round(Math.random() * 10);
    const sugars = 1 + Math.round(Math.random() * 6);
    const sodium = 1200 + Math.round(Math.random() * 1500);
    const petitDej = 200 + Math.round(Math.random() * 400);
    const dejeuner = 300 + Math.round(Math.random() * 500);
    const diner = 250 + Math.round(Math.random() * 450);
    const encas = Math.random() > 0.4 ? 100 + Math.round(Math.random() * 300) : 0;
    const calories = petitDej + dejeuner + diner + encas;
    docs.push({ date, calories, carbs, fat, protein, fiber, sugars, sodium, petitDej, dejeuner, diner, encas, source: 'cronometer' });
  }
  return docs;
};

export const DEMO_DATA = {
  healthLogs: generateDemoHealthLogs(),
  stravaLogs: generateDemoStravaLogs(),
  hevyWorkouts: generateDemoHevyWorkouts(),
  goals: {
    startWeight: 106,
    targetWeight: 95,
    startFat: 26,
    targetFat: 15,
    startWaist: 107,
    targetWaist: 95,
  },
  nutritionDocs: generateDemoNutritionDocs(),
  aiBilan: {
    text: "La tendance sur cinq jours confirme une descente régulière : le poids moyen passe sous les 99 kg et le tour de taille flirte avec les 99 cm, ce qui est plutôt encourageant pour quelqu'un qui a démarré à 107. La graisse corporelle suit le mouvement autour de 20%, dans le bon sens. L'hydratation est correcte, pas de signal d'alerte de ce côté.\n\n[CONSEILS]\nContinue sur cette lancée cétogène sans changer une virgule, la machine tourne.\nPense à mesurer ta tension plus régulièrement, deux points de données par semaine c'est le minimum pour repérer une tendance.\nUn petit rameur ou une marche rapide les jours off musculation ferait du bien au cardio sans taper dans la récup.",
    date: new Date().toISOString().split('T')[0],
  },
};
