import AvatarPlaceholder from "./AvatarPlaceholder";
import type { Staff } from "@/lib/types";

export default function StaffRow({ staff, onSelect }: { staff: Staff; onSelect: (s: Staff) => void }) {
  return (
    <div className="row-press" onClick={() => onSelect(staff)}>
      <div className="flex items-start gap-3 px-4 py-3">
        <AvatarPlaceholder src={staff.photo} name={staff.fullName} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[17px] text-black leading-snug">{staff.fullName}</p>
          <p className="text-[14px] text-[#3c3c43] mt-0.5">{staff.designation} / {staff.department}</p>
          {staff.levelTitle && (
            <p className="text-[14px] text-[#3c3c43] mt-0.5">{staff.levelTitle}</p>
          )}
          <p className="text-[13px] text-[#6b6b6b] mt-1"># {staff.ext}</p>
          <p className="text-[13px] text-[#6b6b6b]">{staff.email}</p>
        </div>
        <div className="chevron mt-1" />
      </div>
      <div className="divider" />
    </div>
  );
}
