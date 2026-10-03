import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ServicesProvider, type AppServices } from '@/app/services';
import { Settings } from '@/app/settings';
import { TutorDB } from '@/data/schema';
import { LearningStore } from '@/data/store';
import { validateStudentAge } from '@/domain/student/student';
import { StudentForm } from './StudentForm';

let n = 0;
function setup(path: string, store: LearningStore) {
  const services = { store, db: store.db, settings: new Settings(store.db) } as unknown as AppServices;
  return render(
    <ServicesProvider services={services}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/new" element={<StudentForm />} />
          <Route path="/s/:sid/settings" element={<StudentForm />} />
          <Route path="/s/:sid" element={<p>home</p>} />
        </Routes>
      </MemoryRouter>
    </ServicesProvider>,
  );
}

describe('student form', () => {
  it('age must be 2 to 119 when given', () => {
    expect(validateStudentAge('')).toBeNull();
    expect(validateStudentAge('2')).toBeNull();
    expect(validateStudentAge('119')).toBeNull();
    expect(validateStudentAge('1')).not.toBeNull();
    expect(validateStudentAge('0')).not.toBeNull();
    expect(validateStudentAge('150')).not.toBeNull();
  });

  it('emptying the age field removes the saved age', async () => {
    const store = new LearningStore(new TutorDB(`form-${++n}`));
    const s = await store.createStudent({ name: 'Ori', birthYear: new Date().getFullYear() - 7 });
    setup(`/s/${s.id}/settings`, store);
    const age = await screen.findByLabelText('גיל');
    expect(age).toHaveValue('7');
    fireEvent.change(age, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'שמירה' }));
    await screen.findByText('home');
    expect((await store.getStudent(s.id))?.birthYear).toBeUndefined();
  });

  it('refuses an out of range age instead of dropping it silently', async () => {
    const store = new LearningStore(new TutorDB(`form-${++n}`));
    setup('/new', store);
    fireEvent.change(await screen.findByLabelText('שם'), { target: { value: 'Dana' } });
    fireEvent.change(screen.getByLabelText('גיל'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'יצירה' }));
    expect(await screen.findByText(/הגיל צריך להיות/)).toBeInTheDocument();
    expect(await store.listStudents()).toHaveLength(0);
  });

  it('refuses a second student with the same name', async () => {
    const store = new LearningStore(new TutorDB(`form-${++n}`));
    await store.createStudent({ name: 'Dana' });
    setup('/new', store);
    // Wait for the student list to load before submitting.
    await waitFor(async () => expect(await store.listStudents()).toHaveLength(1));
    fireEvent.change(await screen.findByLabelText('שם'), { target: { value: ' dana ' } });
    await new Promise((r) => setTimeout(r, 50));
    fireEvent.click(screen.getByRole('button', { name: 'יצירה' }));
    expect(await screen.findByText('כבר יש תלמיד בשם הזה')).toBeInTheDocument();
    expect(await store.listStudents()).toHaveLength(1);
  });
});
