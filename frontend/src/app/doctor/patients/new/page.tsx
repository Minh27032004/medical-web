import { Suspense } from "react";
import PatientForm from "@/components/PatientForm";

export default function NewPatientPage() {
  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Hồ sơ bệnh nhân mới</h1>
      <Suspense>
        <PatientForm />
      </Suspense>
    </div>
  );
}
