import {InteractionForm} from '../../interactions/InteractionForm';
export function AddInteractionModal({personId,personName,...props}:{isOpen:boolean;onClose:()=>void;onSuccess:()=>void;personId:string;personName:string}){return <InteractionForm {...props} initialPersonId={personId} initialPersonName={personName}/>;}
