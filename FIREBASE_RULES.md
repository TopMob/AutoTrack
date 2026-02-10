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

    function normalizedOwnerEmail() {
      return 'shazak6430@gmail.com';
    }

    function managerSettingsPath() {
      return /databases/$(database)/documents/systemSettings/responsibleAssignment;
    }

    function currentResponsibleEmail() {
      return exists(managerSettingsPath())
        ? get(managerSettingsPath()).data.responsibleEmail
        : 'responsible@autotrack.local';
    }

    function isOwner() {
      return isSignedIn() && request.auth.token.email == normalizedOwnerEmail();
    }

    function isResponsible() {
      return isSignedIn() && request.auth.token.email == currentResponsibleEmail();
    }

    function canReadJournal() {
      return isOwner() || isResponsible();
    }

    function isValidTripRecordCreate() {
      return request.resource.data.keys().hasOnly([
        'driverFullName',
        'tripDate',
        'vehicleNumber',
        'odometerValue',
        'dailyMileageValue',
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
      && request.resource.data.dailyMileageValue is int
      && request.resource.data.dailyMileageValue >= 0
      && request.resource.data.tripDescription is string
      && request.resource.data.tripDescription.size() >= 3
      && request.resource.data.tripDescription.size() <= 3000
      && request.resource.data.createdAt == request.time
      && request.resource.data.createdByUserId == request.auth.uid
      && request.resource.data.createdByEmail is string;
    }

    function isValidResponsibleAssignmentWrite() {
      return request.resource.data.keys().hasOnly([
        'responsibleEmail',
        'updatedAt',
        'updatedByEmail'
      ])
      && request.resource.data.responsibleEmail is string
      && request.resource.data.responsibleEmail.size() >= 5
      && request.resource.data.responsibleEmail.size() <= 120
      && request.resource.data.updatedAt == request.time
      && request.resource.data.updatedByEmail == normalizedOwnerEmail();
    }

    match /tripRecords/{recordId} {
      allow create: if isSignedIn() && isValidTripRecordCreate();
      allow read: if canReadJournal();
      allow update, delete: if false;
    }

    match /systemSettings/responsibleAssignment {
      allow read: if isSignedIn();
      allow create, update: if isOwner() && isValidResponsibleAssignmentWrite();
      allow delete: if false;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 2. Firebase Storage Rules

Если загрузка файлов не используется, оставьте Storage закрытым.

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

## 4. Индекс Firestore

Для запроса с сортировкой по `tripDate desc` и `createdAt desc` создайте composite index:

- Collection ID: `tripRecords`
- Fields:
  - `tripDate` Descending
  - `createdAt` Descending

## 5. Что должно совпадать с приложением

- Email владельца: `shazak6430@gmail.com`
- Путь документа ответственного: `systemSettings/responsibleAssignment`
- Поля записи поездки должны совпадать с `isValidTripRecordCreate`
- `createdAt` и `updatedAt` должны писаться как server timestamp
