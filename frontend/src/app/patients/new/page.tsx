import PatientForm from "@/components/PatientForm";

export default function NewPatientPage() {
  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-[#1b2559] mb-4">Bệnh nhân mới</h1>
      <PatientForm />
    </div>
  );
}
