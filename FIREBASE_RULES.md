# Актуальные правила Firebase для AutoTrack

## 1. Firestore Rules

Опубликуйте эти правила в Firebase Console → Firestore Database → Rules.

```rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isSignedIn() {
      return request.auth != null;
    }

    function isResponsible() {
      return isSignedIn() && request.auth.token.email == 'responsible@autotrack.local';
    }

    function isValidTripRecordCreate() {
      return request.resource.data.keys().hasOnly([
        'driverFullName',
        'tripDate',
        'vehicleNumber',
        'odometerValue',
        'tripDescription',
        'createdAt',
        'createdByUserId',
        'createdByEmail'
      ])
      && request.resource.data.driverFullName is string
      && request.resource.data.driverFullName.size() >= 3
      && request.resource.data.driverFullName.size() <= 120
      && request.resource.data.tripDate is string
      && request.resource.data.tripDate.matches('^\\d{4}-\\d{2}-\\d{2}$')
      && request.resource.data.vehicleNumber is string
      && request.resource.data.vehicleNumber.size() >= 3
      && request.resource.data.vehicleNumber.size() <= 20
      && request.resource.data.odometerValue is int
      && request.resource.data.odometerValue >= 0
      && request.resource.data.tripDescription is string
      && request.resource.data.tripDescription.size() >= 3
      && request.resource.data.tripDescription.size() <= 3000
      && request.resource.data.createdAt == request.time
      && request.resource.data.createdByUserId == request.auth.uid
      && request.resource.data.createdByEmail is string;
    }

    match /tripRecords/{recordId} {
      allow create: if isSignedIn() && isValidTripRecordCreate();
      allow read: if isResponsible();
      allow update, delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 2. Firebase Storage Rules

Если в проекте не используется загрузка файлов, храните Storage полностью закрытым.

```rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## 3. Authentication настройки

В Firebase Console → Authentication → Sign-in method включите:

- Email/Password
- Google
- Anonymous

Для Google провайдера проверьте:

- добавлен корректный OAuth Client ID
- в Authorized domains есть ваш боевой домен

## 4. Индекс Firestore

Для запроса с сортировкой по `tripDate desc` и `createdAt desc` создайте composite index:

- Collection ID: `tripRecords`
- Fields:
  - `tripDate` Descending
  - `createdAt` Descending

## 5. Что важно синхронизировать с приложением

- Значение email ответственного в коде приложения должно совпадать со значением в правилах (`responsible@autotrack.local`).
- Поля, которые отправляет форма поездки, должны строго совпадать со списком `hasOnly(...)` в правилах.
- `createdAt` должен писаться только как server timestamp, иначе запись будет блокироваться правилами.
