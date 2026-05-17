import { FiArrowLeft } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'

export function ComingSoon({ title, icon: Icon }) {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-[2rem] border border-dashed border-gray-200 bg-white p-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-amber-50 text-amber-600 shadow-sm">
        <Icon size={40} />
      </div>

      <h2 className="mt-6 text-2xl font-black tracking-tight text-[#111827]">
        {title} · Em desenvolvimento
      </h2>

      <p className="mx-auto mt-3 max-w-md leading-7 text-[#6b7280]">
        Estamos trabalhando duro para liberar essa funcionalidade. Em breve você poderá gerenciar tudo isso diretamente pelo seu painel.
      </p>

      <button
        onClick={() => navigate(-1)}
        className="mt-8 flex items-center gap-2 rounded-2xl bg-[#111827] px-6 py-3 text-sm font-black text-white transition hover:bg-black"
      >
        <FiArrowLeft />
        Voltar ao Dashboard
      </button>
    </div>
  )
}

